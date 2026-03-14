import { DurableObject } from 'cloudflare:workers';
import { dealHands, generateDeck, shuffleDeck } from './deck';
import {
	calculateRoundPoints,
	evaluateTrickWinner,
	isMatchOver,
	MATCH_POINTS_TO_WIN
} from './scoring';
import type { Card, PersistedGameState, PlayedCard, Player } from './types';

// ─── Re-export public types so importers only need this one module ─────────────
export type { Card, PlayedCard, Player } from './types';

// ─── Blank state used on creation and after a full reset ──────────────────────
const BLANK_STATE: Omit<PersistedGameState, 'roomCode'> = {
	isPrivate: false,
	ownerId: null,
	pendingPlayers: [],
	players: [],
	deck: [],
	hands: {},
	trumpCard: null,
	gameStarted: false,
	currentTurnIndex: 0,
	currentTrick: [],
	dealerIndex: 0,
	firstPlayerIndex: 0,
	team1Points: 0,
	team2Points: 0,
	team1MatchPoints: 0,
	team2MatchPoints: 0
};

export class GameRoom extends DurableObject {
	env: any;

	// ── Room metadata ──────────────────────────────────────────────────────────
	roomCode: string = '';
	isPrivate: boolean = false;
	ownerId: string | null = null;
	pendingPlayers: string[] = [];

	// ── Players & cards ────────────────────────────────────────────────────────
	players: Player[] = [];
	deck: Card[] = [];
	hands: Record<string, Card[]> = {};
	trumpCard: Card | null = null;

	// ── Turn tracking ──────────────────────────────────────────────────────────
	gameStarted: boolean = false;
	currentTurnIndex: number = 0;
	currentTrick: PlayedCard[] = [];
	dealerIndex: number = 0;
	firstPlayerIndex: number = 0;

	// ── Scoring ────────────────────────────────────────────────────────────────
	team1Points: number = 0;
	team2Points: number = 0;
	team1MatchPoints: number = 0;
	team2MatchPoints: number = 0;

	// ── In-memory only (not persisted) ────────────────────────────────────────
	disconnectTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

	// ─── Lifecycle ─────────────────────────────────────────────────────────────

	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
		this.env = env;

		// Hydrate from storage before any requests are handled.
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<PersistedGameState>('gameState');
			if (stored) this.hydrateFrom(stored);
		});
	}

	// ─── Storage helpers ───────────────────────────────────────────────────────

	/** Hydrate all fields from a persisted snapshot. */
	private hydrateFrom(s: PersistedGameState): void {
		this.roomCode = s.roomCode ?? '';
		this.isPrivate = s.isPrivate ?? false;
		this.ownerId = s.ownerId ?? null;
		this.pendingPlayers = s.pendingPlayers ?? [];
		this.players = s.players ?? [];
		this.deck = s.deck ?? [];
		this.hands = s.hands ?? {};
		this.trumpCard = s.trumpCard ?? null;
		this.gameStarted = s.gameStarted ?? false;
		this.currentTurnIndex = s.currentTurnIndex ?? 0;
		this.currentTrick = s.currentTrick ?? [];
		this.dealerIndex = s.dealerIndex ?? 0;
		this.firstPlayerIndex = s.firstPlayerIndex ?? 0;
		this.team1Points = s.team1Points ?? 0;
		this.team2Points = s.team2Points ?? 0;
		this.team1MatchPoints = s.team1MatchPoints ?? 0;
		this.team2MatchPoints = s.team2MatchPoints ?? 0;
	}

	/** Persist the current in-memory state. */
	private async saveState(): Promise<void> {
		await this.ctx.storage.put<PersistedGameState>('gameState', {
			roomCode: this.roomCode,
			isPrivate: this.isPrivate,
			ownerId: this.ownerId,
			pendingPlayers: this.pendingPlayers,
			players: this.players,
			deck: this.deck,
			hands: this.hands,
			trumpCard: this.trumpCard,
			gameStarted: this.gameStarted,
			currentTurnIndex: this.currentTurnIndex,
			currentTrick: this.currentTrick,
			dealerIndex: this.dealerIndex,
			firstPlayerIndex: this.firstPlayerIndex,
			team1Points: this.team1Points,
			team2Points: this.team2Points,
			team1MatchPoints: this.team1MatchPoints,
			team2MatchPoints: this.team2MatchPoints
		});
	}

	/**
	 * Wipe all persisted and in-memory state.
	 * Called when the last human leaves — the DO instance can then be reused
	 * as a fresh room (e.g. the same Solo code re-played).
	 */
	private async nukeRoom(): Promise<void> {
		await this.ctx.storage.deleteAll();
		this.hydrateFrom({ roomCode: this.roomCode, ...BLANK_STATE });
		this.ctx.waitUntil(this.reportToLobby());
	}

	// ─── Lobby sync ────────────────────────────────────────────────────────────

	/** Push the current room status to the global LobbyManager DO. */
	private async reportToLobby(): Promise<void> {
		if (!this.roomCode || !this.env.LOBBY_MANAGER || this.roomCode.startsWith('SOLO_')) return;

		const lobbyId = this.env.LOBBY_MANAGER.idFromName('GLOBAL_LOBBY_INSTANCE');
		const lobbyStub = this.env.LOBBY_MANAGER.get(lobbyId);
		const humanCount = this.players.filter((p) => !p.isBot).length;

		try {
			if (humanCount === 0 && this.pendingPlayers.length === 0) {
				await lobbyStub.fetch(`http://internal/lobby?code=${this.roomCode}`, { method: 'DELETE' });
			} else {
				await lobbyStub.fetch('http://internal/lobby', {
					method: 'POST',
					body: JSON.stringify({
						code: this.roomCode,
						isPrivate: this.isPrivate,
						playerCount: this.players.length,
						status: this.gameStarted ? 'playing' : 'waiting'
					})
				});
			}
		} catch (e) {
			console.error('[GameRoom] reportToLobby failed:', e);
		}
	}

	// ─── WebSocket connection handling ─────────────────────────────────────────

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		const url = new URL(request.url);
		this.roomCode = url.pathname.split('/').pop() ?? 'UNKNOWN';

		const isCreatingPrivate = url.searchParams.get('private') === 'true';
		const playerId =
			url.searchParams.get('playerId') ?? crypto.randomUUID().substring(0, 4).toUpperCase();

		const { 0: client, 1: server } = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
		server.serializeAttachment({ playerId });
		this.ctx.acceptWebSocket(server);

		// Cancel any pending disconnect timeout for a reconnecting player.
		this.cancelDisconnectTimeout(playerId);

		this.handleJoin(server, playerId, isCreatingPrivate);

		this.broadcastGameState();
		return new Response(null, { status: 101, webSocket: client });
	}

	/**
	 * Route a newly connected socket through the correct join path:
	 *  1. Reconnecting player (already in players[])
	 *  2. Previously approved but still pending
	 *  3. First player → becomes owner
	 *  4. New player joining an open public room
	 *  5. New player requesting to join a private room
	 *  6. Late-join after game started → error
	 */
	private async handleJoin(
		ws: WebSocket,
		playerId: string,
		isCreatingPrivate: boolean
	): Promise<void> {
		const existingPlayer = this.players.find((p) => p.id === playerId);

		if (existingPlayer) {
			// Reconnection: restore as human and re-sync lobby.
			existingPlayer.isBot = false;
			await this.saveState();
			this.ctx.waitUntil(this.reportToLobby());
			return;
		}

		if (this.pendingPlayers.includes(playerId)) {
			// Player is already queued for approval; just remind the owner.
			ws.send(JSON.stringify({ action: 'WAITING_APPROVAL' }));
			this.notifyOwner();
			return;
		}

		if (this.players.length === 0 && !this.gameStarted) {
			// First arrival → create the room.
			this.isPrivate = isCreatingPrivate;
			this.ownerId = playerId;
			this.players.push({ id: playerId, isBot: false });
			await this.saveState();
			this.ctx.waitUntil(this.reportToLobby());
			return;
		}

		if (!this.gameStarted && this.players.length < 4) {
			if (this.isPrivate) {
				// Private room: queue the player and ask the owner.
				this.pendingPlayers.push(playerId);
				await this.saveState();
				ws.send(JSON.stringify({ action: 'WAITING_APPROVAL' }));
				this.notifyOwner();
			} else {
				// Public room: join immediately.
				this.players.push({ id: playerId, isBot: false });
				await this.saveState();
				this.ctx.waitUntil(this.reportToLobby());
			}
			return;
		}

		if (this.gameStarted) {
			ws.send(JSON.stringify({ action: 'ERROR', message: 'Game already in progress.' }));
		}
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const { playerId } = ws.deserializeAttachment();

		// Don't drop the player if they still have another open socket.
		const otherSockets = this.ctx
			.getWebSockets()
			.filter((s) => s !== ws && s.deserializeAttachment().playerId === playerId);
		if (otherSockets.length > 0) return;

		// Grace period: give the player 5 s to reconnect before dropping them.
		const timeout = setTimeout(async () => {
			this.disconnectTimeouts.delete(playerId);
			await this.handlePlayerDrop(playerId);
		}, 5000);

		this.disconnectTimeouts.set(playerId, timeout);
	}

	// ─── Incoming message dispatch ─────────────────────────────────────────────

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		try {
			const { playerId } = ws.deserializeAttachment();
			const text = typeof message === 'string' ? message : new TextDecoder().decode(message);

			if (text === 'LEAVE_ROOM') return this.handleLeave(playerId);
			if (text === 'START_GAME') return this.handleStartGame(ws, playerId);
			if (text.startsWith('PLAY_CARD:')) return this.handlePlayCard(ws, playerId, text);
			if (text.startsWith('ACCEPT_PLAYER:')) return this.handleAcceptPlayer(playerId, text);
			if (text.startsWith('DECLINE_PLAYER:')) return this.handleDeclinePlayer(playerId, text);
		} catch (err: any) {
			ws.send(JSON.stringify({ action: 'ERROR', message: `SERVER CRASH: ${err.message}` }));
		}
	}

	// ─── Message handlers ──────────────────────────────────────────────────────

	private async handleLeave(playerId: string): Promise<void> {
		await this.handlePlayerDrop(playerId);
	}

	private async handleAcceptPlayer(ownerId: string, text: string): Promise<void> {
		if (ownerId !== this.ownerId) return;
		const targetId = text.split(':')[1];

		this.pendingPlayers = this.pendingPlayers.filter((id) => id !== targetId);

		if (this.players.length < 4 && !this.gameStarted) {
			this.players.push({ id: targetId, isBot: false });
			await this.saveState();
			this.ctx.waitUntil(this.reportToLobby());
			this.broadcastGameState();
		}

		this.notifyOwner();
	}

	private async handleDeclinePlayer(ownerId: string, text: string): Promise<void> {
		if (ownerId !== this.ownerId) return;
		const targetId = text.split(':')[1];

		this.pendingPlayers = this.pendingPlayers.filter((id) => id !== targetId);
		this.sendToPlayer(targetId, { action: 'REJECTED' });
		await this.saveState();
		this.notifyOwner();
	}

	private async handleStartGame(ws: WebSocket, playerId: string): Promise<void> {
		if (this.gameStarted) {
			// Already started — just sync the requesting client.
			this.broadcastGameState();
			return;
		}

		if (this.isPrivate && playerId !== this.ownerId) {
			ws.send(JSON.stringify({ action: 'ERROR', message: 'Only the host can start the game.' }));
			return;
		}

		this.fillWithBots();
		this.rejectPendingPlayers();
		this.dealNewRound();

		await this.saveState();
		this.ctx.waitUntil(this.reportToLobby());
		this.broadcastGameState();

		// Let the deal animation finish before the first bot acts.
		setTimeout(() => this.processTurn(), 3200);
	}

	private async handlePlayCard(ws: WebSocket, playerId: string, text: string): Promise<void> {
		if (!this.gameStarted) return;
		if (this.currentTrick.length >= 4) return;

		const activePlayer = this.players[this.currentTurnIndex];
		if (!activePlayer || activePlayer.id !== playerId) return;

		const cardIndex = parseInt(text.split(':')[1], 10);
		const myHand = this.hands[playerId];
		if (!myHand) return;

		const attemptedCard = myHand[cardIndex];
		if (!attemptedCard) return;

		const validMoves = this.getValidMoves(playerId);
		const isValid = validMoves.some(
			(c) => c.suit === attemptedCard.suit && c.rank === attemptedCard.rank
		);

		if (!isValid) {
			const leadSuit = this.currentTrick[0].card.suit;
			ws.send(
				JSON.stringify({
					action: 'ERROR',
					message: `Renúncia! You must play a card of ${leadSuit}.`
				})
			);
			return;
		}

		const playedCard = myHand.splice(cardIndex, 1)[0];
		this.currentTrick.push({ playerId, card: playedCard });

		await this.saveState();
		this.advanceTurn();
	}

	// ─── Game flow ─────────────────────────────────────────────────────────────

	/**
	 * Called after each card is played.
	 * - Advances the turn index normally (< 4 cards played).
	 * - When a trick is complete (4 cards), scores it and either starts the
	 *   next trick or ends the round.
	 */
	private async advanceTurn(): Promise<void> {
		const trickComplete = this.currentTrick.length === 4;

		if (!trickComplete) {
			this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
			await this.saveState();
			this.broadcastGameState();
			this.processTurn();
			return;
		}

		// Broadcast the completed trick before the 1-second pause.
		this.broadcastGameState();

		setTimeout(async () => {
			await this.resolveTrick();
		}, 1000);
	}

	/** Score the completed trick and either start the next trick or end the round. */
	private async resolveTrick(): Promise<void> {
		const winnerId = evaluateTrickWinner(this.currentTrick, this.trumpCard!.suit);
		const winnerIndex = this.players.findIndex((p) => p.id === winnerId);
		const trickPoints = this.currentTrick.reduce((sum, play) => sum + play.card.value, 0);

		// Team 1 = indices 0,2 · Team 2 = indices 1,3
		if (winnerIndex % 2 === 0) this.team1Points += trickPoints;
		else this.team2Points += trickPoints;

		this.currentTurnIndex = winnerIndex;
		this.currentTrick = [];

		const roundOver = Object.values(this.hands).every((h) => h.length === 0);

		if (roundOver) {
			await this.endRound();
			return;
		}

		await this.saveState();
		this.broadcastGameState();
		this.processTurn();
	}

	/** Tally scores, broadcast GAME_OVER, and advance the dealer for next round. */
	private async endRound(): Promise<void> {
		this.gameStarted = false;

		const { team1RoundPoints, team2RoundPoints, summary } = calculateRoundPoints(
			this.team1Points,
			this.team2Points
		);
		this.team1MatchPoints += team1RoundPoints;
		this.team2MatchPoints += team2RoundPoints;

		let matchResult = summary;
		let matchOver = false;

		if (isMatchOver(this.team1MatchPoints, this.team2MatchPoints)) {
			const winner = this.team1MatchPoints >= MATCH_POINTS_TO_WIN ? 'Team 1' : 'Team 2';
			matchResult += `\n\n🏆 ${winner} WINS THE ENTIRE MATCH! 🏆`;
			this.team1MatchPoints = 0;
			this.team2MatchPoints = 0;
			matchOver = true;
		}

		this.dealerIndex = (this.dealerIndex + 1) % 4;

		await this.saveState();
		this.ctx.waitUntil(this.reportToLobby());
		this.broadcastGameState();
		this.broadcast({
			action: 'GAME_OVER',
			t1: this.team1Points,
			t2: this.team2Points,
			matchResult,
			isMatchOver: matchOver
		});
	}

	/** Bot AI: play a random valid card after a short delay. */
	private processTurn(): void {
		const activePlayer = this.players[this.currentTurnIndex];
		if (!activePlayer?.isBot) return;

		const botHand = this.hands[activePlayer.id];
		if (!botHand?.length) return;

		setTimeout(async () => {
			const validMoves = this.getValidMoves(activePlayer.id);
			const chosen = validMoves[Math.floor(Math.random() * validMoves.length)];
			const chosenIndex = botHand.findIndex(
				(c) => c.suit === chosen.suit && c.rank === chosen.rank
			);
			const playedCard = botHand.splice(chosenIndex, 1)[0];
			this.currentTrick.push({ playerId: activePlayer.id, card: playedCard });
			await this.saveState();
			this.advanceTurn();
		}, 1000);
	}

	/**
	 * Enforce the "follow-suit" (Renúncia) rule.
	 * Returns the cards the player is allowed to play.
	 */
	private getValidMoves(playerId: string): Card[] {
		const hand = this.hands[playerId];
		if (!hand || this.currentTrick.length === 0) return hand ?? [];
		const leadSuit = this.currentTrick[0].card.suit;
		const suitCards = hand.filter((c) => c.suit === leadSuit);
		return suitCards.length > 0 ? suitCards : hand;
	}

	// ─── Round setup helpers ───────────────────────────────────────────────────

	/** Add bots until the table has 4 players. */
	private fillWithBots(): void {
		const existingBotNums = this.players
			.map((p) => p.id.match(/^BOT_(\d+)$/))
			.filter(Boolean)
			.map((m) => parseInt(m![1], 10));
		let botCounter = existingBotNums.length > 0 ? Math.max(...existingBotNums) + 1 : 1;
		while (this.players.length < 4) {
			// Skip any counter values that are already taken.
			while (this.players.some((p) => p.id === `BOT_${botCounter}`)) botCounter++;
			this.players.push({ id: `BOT_${botCounter}`, isBot: true });
			botCounter++;
		}
	}

	/** Send REJECTED to every pending player and clear the queue. */
	private rejectPendingPlayers(): void {
		this.pendingPlayers.forEach((targetId) => this.sendToPlayer(targetId, { action: 'REJECTED' }));
		this.pendingPlayers = [];
	}

	/**
	 * Shuffle a fresh deck, deal 10 cards to each player, handle the trump-card
	 * swap (the player holding the trump card gives it to the dealer and takes
	 * the dealer's top card), then set up turn order.
	 */
	private dealNewRound(): void {
		this.deck = generateDeck();
		shuffleDeck(this.deck);

		this.trumpCard = this.deck[39];
		const playerIds = this.players.map((p) => p.id);
		this.hands = dealHands(this.deck, playerIds);

		this.performTrumpSwap();

		// Only randomise the first dealer; subsequent rounds rotate.
		const isFirstRound =
			this.team1Points === 0 &&
			this.team2Points === 0 &&
			this.team1MatchPoints === 0 &&
			this.team2MatchPoints === 0;
		if (isFirstRound) {
			this.dealerIndex = Math.floor(Math.random() * 4);
		}

		this.gameStarted = true;
		this.firstPlayerIndex = (this.dealerIndex + 1) % 4;
		this.currentTurnIndex = this.firstPlayerIndex;
		this.currentTrick = [];
		this.team1Points = 0;
		this.team2Points = 0;
	}

	/**
	 * Sueca trump-swap rule: whoever holds the trump card in their initial hand
	 * gives it to the dealer. The dealer gives back the top card of their hand
	 * (unless the dealer already holds the trump card, in which case no swap).
	 */
	private performTrumpSwap(): void {
		const dealerId = this.players[this.dealerIndex].id;

		for (let i = 0; i < 4; i++) {
			const playerHand = this.hands[this.players[i].id];
			const trumpIndex = playerHand.findIndex(
				(c) => c.suit === this.trumpCard!.suit && c.rank === this.trumpCard!.rank
			);
			if (trumpIndex === -1) continue;

			// Found the trump holder.
			playerHand.splice(trumpIndex, 1);
			this.hands[dealerId].push(this.trumpCard!);

			if (i !== this.dealerIndex) {
				// Give the dealer's former top card back to the trump holder.
				const swappedCard = this.hands[dealerId].shift()!;
				playerHand.push(swappedCard);
			}
			break;
		}
	}

	// ─── Disconnect / player drop ──────────────────────────────────────────────

	private cancelDisconnectTimeout(playerId: string): void {
		const existing = this.disconnectTimeouts.get(playerId);
		if (existing) {
			clearTimeout(existing);
			this.disconnectTimeouts.delete(playerId);
		}
	}

	/**
	 * Handle a player leaving (either graceful LEAVE_ROOM or disconnect timeout).
	 *
	 * - Remove from pending queue.
	 * - If game is running, convert to a bot; otherwise remove entirely.
	 * - If the owner left, promote the next human.
	 * - If no humans remain, nuke the room.
	 */
	private async handlePlayerDrop(playerId: string): Promise<void> {
		this.pendingPlayers = this.pendingPlayers.filter((id) => id !== playerId);
		this.notifyOwner();

		const playerIndex = this.players.findIndex((p) => p.id === playerId);

		if (playerIndex !== -1) {
			if (this.gameStarted) {
				this.players[playerIndex].isBot = true;
				const hasHumansLeft = this.players.some((p) => !p.isBot);
				if (hasHumansLeft && this.currentTurnIndex === playerIndex) {
					this.processTurn();
				}
			} else {
				this.players.splice(playerIndex, 1);
			}

			if (this.ownerId === playerId) {
				const nextHuman = this.players.find((p) => !p.isBot);
				this.ownerId = nextHuman?.id ?? null;
			}
		}

		const hasHumans = this.players.some((p) => !p.isBot);
		if (!hasHumans) {
			// No humans left — wipe everything so the room can be reused fresh.
			await this.nukeRoom();
			return;
		}

		await this.saveState();
		this.broadcastGameState();
		this.ctx.waitUntil(this.reportToLobby());
	}

	// ─── Broadcast helpers ─────────────────────────────────────────────────────

	/**
	 * Send each connected socket a personalised state snapshot.
	 * Each player only sees their own hand; other hands are opaque size counts.
	 */
	private broadcastGameState(): void {
		const handSizes: Record<string, number> = {};
		for (const pid in this.hands) {
			handSizes[pid] = this.hands[pid].length;
		}

		for (const socket of this.ctx.getWebSockets()) {
			const { playerId } = socket.deserializeAttachment();
			socket.send(
				JSON.stringify({
					action: 'GAME_STATE_UPDATE',
					gameStarted: this.gameStarted,
					ownerId: this.ownerId,
					players: this.players,
					activePlayerId: this.players[this.currentTurnIndex]?.id,
					dealerId: this.players[this.dealerIndex]?.id,
					table: this.currentTrick,
					myHand: this.hands[playerId] ?? [],
					handSizes,
					myPlayerId: playerId,
					team1Points: this.team1Points,
					team2Points: this.team2Points,
					team1MatchPoints: this.team1MatchPoints,
					team2MatchPoints: this.team2MatchPoints,
					trumpCard: this.trumpCard
				})
			);
		}
	}

	/** Broadcast the same payload to every connected socket. */
	private broadcast(data: unknown): void {
		for (const socket of this.ctx.getWebSockets()) {
			socket.send(JSON.stringify(data));
		}
	}

	/** Send a message only to the sockets belonging to a specific player. */
	private sendToPlayer(targetPlayerId: string, data: unknown): void {
		for (const socket of this.ctx.getWebSockets()) {
			if (socket.deserializeAttachment().playerId === targetPlayerId) {
				socket.send(JSON.stringify(data));
			}
		}
	}

	/** Notify the room owner of the current pending-player queue. */
	private notifyOwner(): void {
		if (!this.ownerId) return;
		this.sendToPlayer(this.ownerId, {
			action: 'APPROVAL_REQUEST',
			requests: this.pendingPlayers
		});
	}
}

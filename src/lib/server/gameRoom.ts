import { DurableObject } from 'cloudflare:workers';

type Suit = 'copas' | 'espadas' | 'ouros' | 'paus';
type Rank = '2' | '3' | '4' | '5' | '6' | 'Q' | 'J' | 'K' | '7' | 'A';

export interface Card {
	suit: Suit;
	rank: Rank;
	value: number;
}
export interface Player {
	id: string;
	isBot: boolean;
}
export interface PlayedCard {
	playerId: string;
	card: Card;
}

export class GameRoom extends DurableObject {
	env: any;
	roomCode: string = '';

	isPrivate: boolean = false;
	ownerId: string | null = null;
	pendingPlayers: string[] = [];

	players: Player[] = [];
	deck: Card[] = [];
	hands: Record<string, Card[]> = {};
	trumpCard: Card | null = null;
	gameStarted: boolean = false;

	currentTurnIndex: number = 0;
	currentTrick: PlayedCard[] = [];
	dealerIndex: number = 0;
	firstPlayerIndex: number = 0;

	team1Points: number = 0;
	team2Points: number = 0;
	team1MatchPoints: number = 0;
	team2MatchPoints: number = 0;

	disconnectTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
		this.env = env;

		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<any>('gameState');
			if (stored) {
				this.roomCode = stored.roomCode || '';
				this.isPrivate = stored.isPrivate || false;
				this.ownerId = stored.ownerId || null;
				this.pendingPlayers = stored.pendingPlayers || [];
				this.players = stored.players || [];
				this.deck = stored.deck || [];
				this.hands = stored.hands || {};
				this.trumpCard = stored.trumpCard || null;
				this.gameStarted = stored.gameStarted || false;
				this.currentTurnIndex = stored.currentTurnIndex || 0;
				this.currentTrick = stored.currentTrick || [];
				this.dealerIndex = stored.dealerIndex || 0;
				this.firstPlayerIndex = stored.firstPlayerIndex || 0;
				this.team1Points = stored.team1Points || 0;
				this.team2Points = stored.team2Points || 0;
				this.team1MatchPoints = stored.team1MatchPoints || 0;
				this.team2MatchPoints = stored.team2MatchPoints || 0;
			}
		});
	}

	private async saveState() {
		await this.ctx.storage.put('gameState', {
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

	private async reportToLobby() {
		if (!this.roomCode || !this.env.LOBBY_MANAGER || this.roomCode.startsWith('SOLO_')) return;

		try {
			const lobbyId = this.env.LOBBY_MANAGER.idFromName('GLOBAL_LOBBY_INSTANCE');
			const lobbyStub = this.env.LOBBY_MANAGER.get(lobbyId);
			const humanCount = this.players.filter((p) => !p.isBot).length;

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
			console.error(e);
		}
	}

	private notifyOwner() {
		if (!this.ownerId) return;
		const sockets = this.ctx.getWebSockets();
		sockets.forEach((ws) => {
			if (ws.deserializeAttachment().playerId === this.ownerId) {
				ws.send(JSON.stringify({ action: 'APPROVAL_REQUEST', requests: this.pendingPlayers }));
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket')
			return new Response('Expected WS', { status: 426 });

		const url = new URL(request.url);
		this.roomCode = url.pathname.split('/').pop() || 'UNKNOWN';
		const isCreatingPrivate = url.searchParams.get('private') === 'true';

		let playerId = url.searchParams.get('playerId');
		if (!playerId) playerId = crypto.randomUUID().substring(0, 4).toUpperCase();

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		server.serializeAttachment({ playerId });
		this.ctx.acceptWebSocket(server);

		const existingPlayer = this.players.find((p) => p.id === playerId);

		if (this.disconnectTimeouts.has(playerId)) {
			clearTimeout(this.disconnectTimeouts.get(playerId));
			this.disconnectTimeouts.delete(playerId);
		}

		if (existingPlayer) {
			existingPlayer.isBot = false;
			await this.saveState();
			this.ctx.waitUntil(this.reportToLobby());
		} else if (this.pendingPlayers.includes(playerId)) {
			server.send(JSON.stringify({ action: 'WAITING_APPROVAL' }));
			this.notifyOwner();
		} else if (this.players.length === 0 && !this.gameStarted) {
			this.isPrivate = isCreatingPrivate;
			this.ownerId = playerId;
			this.players.push({ id: playerId, isBot: false });
			await this.saveState();
			this.ctx.waitUntil(this.reportToLobby());
		} else if (!this.gameStarted && this.players.length < 4) {
			if (this.isPrivate && this.ownerId !== playerId) {
				if (!this.pendingPlayers.includes(playerId)) {
					this.pendingPlayers.push(playerId);
					await this.saveState();
				}
				server.send(JSON.stringify({ action: 'WAITING_APPROVAL' }));
				this.notifyOwner();
			} else {
				this.players.push({ id: playerId, isBot: false });
				await this.saveState();
				this.ctx.waitUntil(this.reportToLobby());
			}
		} else if (this.gameStarted) {
			server.send(JSON.stringify({ action: 'ERROR', message: 'Game already in progress.' }));
		}

		this.broadcastGameState();
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			const { playerId } = ws.deserializeAttachment();
			const textMessage = typeof message === 'string' ? message : new TextDecoder().decode(message);

			if (textMessage === 'LEAVE_ROOM') {
				await this.handlePlayerDrop(playerId);
				return;
			}

			if (textMessage.startsWith('ACCEPT_PLAYER:')) {
				if (playerId !== this.ownerId) return;
				const targetId = textMessage.split(':')[1];

				this.pendingPlayers = this.pendingPlayers.filter((id) => id !== targetId);
				if (this.players.length < 4 && !this.gameStarted) {
					this.players.push({ id: targetId, isBot: false });
					await this.saveState();
					this.ctx.waitUntil(this.reportToLobby());
					this.broadcastGameState();
					this.notifyOwner();
				}
				return;
			}

			if (textMessage.startsWith('DECLINE_PLAYER:')) {
				if (playerId !== this.ownerId) return;
				const targetId = textMessage.split(':')[1];

				this.pendingPlayers = this.pendingPlayers.filter((id) => id !== targetId);
				const sockets = this.ctx.getWebSockets();
				sockets.forEach((s) => {
					if (s.deserializeAttachment().playerId === targetId) {
						s.send(JSON.stringify({ action: 'REJECTED' }));
					}
				});
				await this.saveState();
				this.notifyOwner();
				return;
			}

			if (!this.players.find((p) => p.id === playerId) && !this.pendingPlayers.includes(playerId)) {
				if (this.isPrivate && this.ownerId !== playerId) {
					this.pendingPlayers.push(playerId);
					ws.send(JSON.stringify({ action: 'WAITING_APPROVAL' }));
					this.notifyOwner();
				} else {
					this.players.push({ id: playerId, isBot: false });
					await this.saveState();
					this.ctx.waitUntil(this.reportToLobby());
				}
			}

			if (textMessage === 'START_GAME' && !this.gameStarted) {
				if (this.isPrivate && playerId !== this.ownerId) {
					ws.send(
						JSON.stringify({ action: 'ERROR', message: 'Only the host can start the game.' })
					);
					return;
				}

				let botCounter = 1;
				while (this.players.length < 4) {
					this.players.push({ id: `BOT_${botCounter}`, isBot: true });
					botCounter++;
				}

				const sockets = this.ctx.getWebSockets();
				this.pendingPlayers.forEach((targetId) => {
					sockets.forEach((s) => {
						if (s.deserializeAttachment().playerId === targetId)
							s.send(JSON.stringify({ action: 'REJECTED' }));
					});
				});
				this.pendingPlayers = [];

				this.deck = this.generateDeck();
				this.shuffleDeck(this.deck);

				this.trumpCard = this.deck[39];

				for (let i = 0; i < 4; i++) {
					this.hands[this.players[i].id] = this.deck.slice(i * 10, i * 10 + 10);
				}

				const dealerId = this.players[this.dealerIndex].id;
				for (let i = 0; i < 4; i++) {
					const playerHand = this.hands[this.players[i].id];
					const trunfoIndex = playerHand.findIndex(
						(c) => c.suit === this.trumpCard!.suit && c.rank === this.trumpCard!.rank
					);
					if (trunfoIndex !== -1) {
						playerHand.splice(trunfoIndex, 1);
						this.hands[dealerId].push(this.trumpCard);
						if (i !== this.dealerIndex) {
							const swappedCard = this.hands[dealerId].shift()!;
							playerHand.push(swappedCard);
						}
						break;
					}
				}

				this.gameStarted = true;
				this.firstPlayerIndex = (this.dealerIndex - 1 + 4) % 4;
				this.currentTurnIndex = this.firstPlayerIndex;

				this.currentTrick = [];
				this.team1Points = 0;
				this.team2Points = 0;

				await this.saveState();
				this.ctx.waitUntil(this.reportToLobby());
				this.broadcastGameState();
				this.processTurn();
				return;
			}

			if (textMessage.startsWith('PLAY_CARD')) {
				if (!this.gameStarted) return;
				if (this.currentTrick.length >= 4) return;
				const activePlayer = this.players[this.currentTurnIndex];
				if (!activePlayer || activePlayer.id !== playerId) return;

				const cardIndex = parseInt(textMessage.split(':')[1], 10);
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
		} catch (err: any) {
			ws.send(JSON.stringify({ action: 'ERROR', message: `SERVER CRASH: ${err.message}` }));
		}
	}

	async webSocketClose(ws: WebSocket) {
		const { playerId } = ws.deserializeAttachment();

		const activeSockets = this.ctx
			.getWebSockets()
			.filter((s) => s !== ws && s.deserializeAttachment().playerId === playerId);
		if (activeSockets.length > 0) return;

		const timeout = setTimeout(async () => {
			this.disconnectTimeouts.delete(playerId);
			await this.handlePlayerDrop(playerId);
		}, 5000);

		this.disconnectTimeouts.set(playerId, timeout);
	}

	private async handlePlayerDrop(playerId: string) {
		this.pendingPlayers = this.pendingPlayers.filter((id) => id !== playerId);
		this.notifyOwner();

		const playerIndex = this.players.findIndex((p) => p.id === playerId);
		if (playerIndex !== -1) {
			if (this.gameStarted) {
				this.players[playerIndex].isBot = true;
				const humanCount = this.players.filter((p) => !p.isBot).length;
				if (humanCount === 0) {
					this.gameStarted = false;
					this.players = [];
				} else if (this.currentTurnIndex === playerIndex) {
					this.processTurn();
				}
			} else {
				this.players.splice(playerIndex, 1);
			}

			if (this.ownerId === playerId && this.players.length > 0) {
				const nextHuman = this.players.find((p) => !p.isBot);
				this.ownerId = nextHuman ? nextHuman.id : null;
			}
		}

		await this.saveState();
		this.broadcastGameState();
		this.ctx.waitUntil(this.reportToLobby());
	}

	private async advanceTurn() {
		if (this.currentTrick.length === 4) {
			this.broadcastGameState();
			setTimeout(async () => {
				const winnerId = this.evaluateTrickWinner();
				const winnerIndex = this.players.findIndex((p) => p.id === winnerId);
				const trickPoints = this.currentTrick.reduce((sum, play) => sum + play.card.value, 0);

				if (winnerIndex % 2 === 0) this.team1Points += trickPoints;
				else this.team2Points += trickPoints;

				this.currentTurnIndex = winnerIndex;
				this.currentTrick = [];

				if (this.hands[this.players[0].id].length === 0) {
					this.gameStarted = false;
					let matchResult = '';

					if (this.team1Points > 60) {
						const pts = this.team1Points === 120 ? 4 : this.team1Points > 90 ? 2 : 1;
						this.team1MatchPoints += pts;
						matchResult = `Team 1 wins ${pts} match point(s)!`;
					} else if (this.team2Points > 60) {
						const pts = this.team2Points === 120 ? 4 : this.team2Points > 90 ? 2 : 1;
						this.team2MatchPoints += pts;
						matchResult = `Team 2 wins ${pts} match point(s)!`;
					} else {
						matchResult = 'Draw! 60 - 60.';
					}

					if (this.team1MatchPoints >= 4) {
						matchResult += '\n\n🏆 TEAM 1 WINS THE ENTIRE MATCH! 🏆';
						this.team1MatchPoints = 0;
						this.team2MatchPoints = 0;
					} else if (this.team2MatchPoints >= 4) {
						matchResult += '\n\n🏆 TEAM 2 WINS THE ENTIRE MATCH! 🏆';
						this.team1MatchPoints = 0;
						this.team2MatchPoints = 0;
					}

					this.dealerIndex = (this.dealerIndex - 1 + 4) % 4;

					await this.saveState();
					this.ctx.waitUntil(this.reportToLobby());
					this.broadcast({
						action: 'GAME_OVER',
						t1: this.team1Points,
						t2: this.team2Points,
						matchResult
					});
					return;
				}
				await this.saveState();
				this.broadcastGameState();
				this.processTurn();
			}, 2000);
			return;
		}
		this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
		await this.saveState();
		this.broadcastGameState();
		this.processTurn();
	}

	private evaluateTrickWinner(): string {
		const leadSuit = this.currentTrick[0].card.suit;
		const trumpSuit = this.trumpCard!.suit;
		const rankPower: Record<Rank, number> = {
			A: 10,
			'7': 9,
			K: 8,
			J: 7,
			Q: 6,
			'6': 5,
			'5': 4,
			'4': 3,
			'3': 2,
			'2': 1
		};
		let winningPlay = this.currentTrick[0];
		let maxPower = -1;
		for (const play of this.currentTrick) {
			let power = 0;
			if (play.card.suit === trumpSuit) power = 1000 + rankPower[play.card.rank];
			else if (play.card.suit === leadSuit) power = 100 + rankPower[play.card.rank];
			if (power > maxPower) {
				maxPower = power;
				winningPlay = play;
			}
		}
		return winningPlay.playerId;
	}

	private processTurn() {
		const activePlayer = this.players[this.currentTurnIndex];
		if (activePlayer && activePlayer.isBot) {
			const botHand = this.hands[activePlayer.id];
			if (!botHand || botHand.length === 0) return;
			setTimeout(async () => {
				const validMoves = this.getValidMoves(activePlayer.id);
				const randomValidCard = validMoves[Math.floor(Math.random() * validMoves.length)];
				const cardIndexInHand = botHand.findIndex(
					(c) => c.suit === randomValidCard.suit && c.rank === randomValidCard.rank
				);
				const playedCard = botHand.splice(cardIndexInHand, 1)[0];
				this.currentTrick.push({ playerId: activePlayer.id, card: playedCard });
				await this.saveState();
				this.advanceTurn();
			}, 1000);
		}
	}

	private getValidMoves(playerId: string): Card[] {
		const myHand = this.hands[playerId];
		if (!myHand || this.currentTrick.length === 0) return myHand || [];
		const leadSuit = this.currentTrick[0].card.suit;
		const cardsOfLeadSuit = myHand.filter((card) => card.suit === leadSuit);
		return cardsOfLeadSuit.length > 0 ? cardsOfLeadSuit : myHand;
	}

	private broadcastGameState() {
		const allSockets = this.ctx.getWebSockets();
		allSockets.forEach((socket) => {
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
					myHand: this.hands[playerId] || [],
					myPlayerId: playerId,
					team1Points: this.team1Points,
					team2Points: this.team2Points,
					team1MatchPoints: this.team1MatchPoints,
					team2MatchPoints: this.team2MatchPoints,
					trumpCard: this.trumpCard
				})
			);
		});
	}

	private broadcast(data: any) {
		const allSockets = this.ctx.getWebSockets();
		allSockets.forEach((s) => s.send(JSON.stringify(data)));
	}

	private generateDeck(): Card[] {
		const suits: Suit[] = ['copas', 'espadas', 'ouros', 'paus'];
		const ranks: { rank: Rank; value: number }[] = [
			{ rank: 'A', value: 11 },
			{ rank: '7', value: 10 },
			{ rank: 'K', value: 4 },
			{ rank: 'J', value: 3 },
			{ rank: 'Q', value: 2 },
			{ rank: '6', value: 0 },
			{ rank: '5', value: 0 },
			{ rank: '4', value: 0 },
			{ rank: '3', value: 0 },
			{ rank: '2', value: 0 }
		];
		const newDeck: Card[] = [];
		for (const suit of suits)
			for (const { rank, value } of ranks) newDeck.push({ suit, rank, value });
		return newDeck;
	}

	private shuffleDeck(deck: Card[]) {
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
	}
}

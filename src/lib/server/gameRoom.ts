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
	players: Player[] = [];
	deck: Card[] = [];
	hands: Record<string, Card[]> = {};
	trumpCard: Card | null = null;
	gameStarted: boolean = false;

	currentTurnIndex: number = 0;
	currentTrick: PlayedCard[] = [];

	team1Points: number = 0;
	team2Points: number = 0;
	team1MatchPoints: number = 0;
	team2MatchPoints: number = 0;

	constructor(ctx: DurableObjectState, env: unknown) {
		super(ctx, env);
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<any>('gameState');
			if (stored) {
				this.players = stored.players || [];
				this.deck = stored.deck || [];
				this.hands = stored.hands || {};
				this.trumpCard = stored.trumpCard || null;
				this.gameStarted = stored.gameStarted || false;
				this.currentTurnIndex = stored.currentTurnIndex || 0;
				this.currentTrick = stored.currentTrick || [];
				this.team1Points = stored.team1Points || 0;
				this.team2Points = stored.team2Points || 0;
				this.team1MatchPoints = stored.team1MatchPoints || 0;
				this.team2MatchPoints = stored.team2MatchPoints || 0;
			}
		});
	}

	private async saveState() {
		await this.ctx.storage.put('gameState', {
			players: this.players,
			deck: this.deck,
			hands: this.hands,
			trumpCard: this.trumpCard,
			gameStarted: this.gameStarted,
			currentTurnIndex: this.currentTurnIndex,
			currentTrick: this.currentTrick,
			team1Points: this.team1Points,
			team2Points: this.team2Points,
			team1MatchPoints: this.team1MatchPoints,
			team2MatchPoints: this.team2MatchPoints
		});
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket')
			return new Response('Expected Upgrade: websocket', { status: 426 });

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		const playerId = crypto.randomUUID().substring(0, 4).toUpperCase();

		server.serializeAttachment({ playerId });
		this.ctx.acceptWebSocket(server);

		if (!this.gameStarted && this.players.length < 4) {
			this.players.push({ id: playerId, isBot: false });
			await this.saveState();
		}

		server.send(
			JSON.stringify({
				action: 'GAME_STATE_UPDATE',
				gameStarted: this.gameStarted,
				players: this.players,
				activePlayerId: this.players[this.currentTurnIndex]?.id,
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

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			const { playerId } = ws.deserializeAttachment();
			const textMessage = typeof message === 'string' ? message : new TextDecoder().decode(message);

			if (!this.players.find((p) => p.id === playerId)) {
				this.players.push({ id: playerId, isBot: false });
				await this.saveState();
			}

			if (textMessage === 'START_GAME' && !this.gameStarted) {
				let botCounter = 1;
				while (this.players.length < 4) {
					this.players.push({ id: `BOT_${botCounter}`, isBot: true });
					botCounter++;
				}

				this.deck = this.generateDeck();
				this.shuffleDeck(this.deck);
				this.trumpCard = this.deck[this.deck.length - 1];

				for (let i = 0; i < 4; i++) {
					this.hands[this.players[i].id] = this.deck.slice(i * 10, i * 10 + 10);
				}

				this.gameStarted = true;
				this.currentTurnIndex = 0;
				this.currentTrick = [];
				this.team1Points = 0;
				this.team2Points = 0;

				await this.saveState();
				this.broadcastGameState();
				this.processTurn();
				return;
			}

			if (textMessage.startsWith('PLAY_CARD')) {
				if (!this.gameStarted) {
					ws.send(JSON.stringify({ action: 'ERROR', message: 'Game has not started!' }));
					return;
				}

				if (this.currentTrick.length >= 4) {
					ws.send(JSON.stringify({ action: 'ERROR', message: 'Table is full, resolving...' }));
					return;
				}

				const activePlayer = this.players[this.currentTurnIndex];
				if (!activePlayer || activePlayer.id !== playerId) {
					ws.send(JSON.stringify({ action: 'ERROR', message: "Wait! It's not your turn." }));
					return;
				}

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
		if (!this.gameStarted) {
			this.players = this.players.filter((p) => p.id !== playerId);
			await this.saveState();
		}
	}

	private async advanceTurn() {
		if (this.currentTrick.length === 4) {
			this.broadcastGameState();

			setTimeout(async () => {
				const winnerId = this.evaluateTrickWinner();
				const winnerIndex = this.players.findIndex((p) => p.id === winnerId);

				const trickPoints = this.currentTrick.reduce((sum, play) => sum + play.card.value, 0);

				if (winnerIndex % 2 === 0) {
					this.team1Points += trickPoints;
				} else {
					this.team2Points += trickPoints;
				}

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

					await this.saveState();
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
			if (play.card.suit === trumpSuit) {
				power = 1000 + rankPower[play.card.rank];
			} else if (play.card.suit === leadSuit) {
				power = 100 + rankPower[play.card.rank];
			}
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
					players: this.players,
					activePlayerId: this.players[this.currentTurnIndex]?.id,
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

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

export class GameRoom extends DurableObject {
	players: Player[] = [];
	deck: Card[] = [];
	hands: Record<string, Card[]> = {};
	trumpCard: Card | null = null;
	gameStarted: boolean = false;

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		const playerId = crypto.randomUUID().substring(0, 4).toUpperCase();
		server.serializeAttachment({ playerId });

		this.ctx.acceptWebSocket(server);

		if (!this.gameStarted && this.players.length < 4) {
			this.players.push({ id: playerId, isBot: false });
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const { playerId } = ws.deserializeAttachment();
		const textMessage = typeof message === 'string' ? message : new TextDecoder().decode(message);

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
				const pId = this.players[i].id;
				this.hands[pId] = this.deck.slice(i * 10, i * 10 + 10);
			}

			this.gameStarted = true;

			const allSockets = this.ctx.getWebSockets();
			allSockets.forEach((socket) => {
				const { playerId: socketPlayerId } = socket.deserializeAttachment();

				const myHand = this.hands[socketPlayerId];

				socket.send(
					JSON.stringify({
						action: 'GAME_STARTED',
						message: `Game on! Trump is ${this.trumpCard?.rank} of ${this.trumpCard?.suit}`,
						trump: this.trumpCard,
						players: this.players,
						hand: myHand
					})
				);
			});
			return;
		}

		const allSockets = this.ctx.getWebSockets();
		allSockets.forEach((socket) => {
			socket.send(JSON.stringify({ action: 'BROADCAST', sender: playerId, message: textMessage }));
		});
	}

	async webSocketClose(ws: WebSocket) {
		const { playerId } = ws.deserializeAttachment();
		if (!this.gameStarted) {
			this.players = this.players.filter((p) => p.id !== playerId);
		}
		console.log(`Player ${playerId} disconnected.`);
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
		for (const suit of suits) {
			for (const { rank, value } of ranks) {
				newDeck.push({ suit, rank, value });
			}
		}
		return newDeck;
	}

	private shuffleDeck(deck: Card[]) {
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
	}
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Suit = 'copas' | 'espadas' | 'ouros' | 'paus';
export type Rank = '2' | '3' | '4' | '5' | '6' | 'Q' | 'J' | 'K' | '7' | 'A';

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

// ─── Serialisable Game State (stored in Durable Object storage) ───────────────

export interface PersistedGameState {
	// Room metadata
	roomCode: string;
	isPrivate: boolean;
	ownerId: string | null;
	pendingPlayers: string[];

	// Players & cards
	players: Player[];
	deck: Card[];
	hands: Record<string, Card[]>;
	trumpCard: Card | null;

	// Turn tracking
	gameStarted: boolean;
	currentTurnIndex: number;
	currentTrick: PlayedCard[];
	dealerIndex: number;
	firstPlayerIndex: number;

	// Scoring
	team1Points: number;
	team2Points: number;
	team1MatchPoints: number;
	team2MatchPoints: number;
}

// ─── Client → Server WebSocket Messages (plain strings) ──────────────────────

export type ClientMessage =
	| 'LEAVE_ROOM'
	| 'START_GAME'
	| `PLAY_CARD:${number}`
	| `ACCEPT_PLAYER:${string}`
	| `DECLINE_PLAYER:${string}`;

// ─── Server → Client WebSocket Messages (JSON) ───────────────────────────────

export interface GameStateUpdateMsg {
	action: 'GAME_STATE_UPDATE';
	gameStarted: boolean;
	ownerId: string | null;
	players: Player[];
	activePlayerId: string | undefined;
	dealerId: string | undefined;
	table: PlayedCard[];
	myHand: Card[];
	handSizes: Record<string, number>;
	myPlayerId: string;
	team1Points: number;
	team2Points: number;
	team1MatchPoints: number;
	team2MatchPoints: number;
	trumpCard: Card | null;
}

export interface GameOverMsg {
	action: 'GAME_OVER';
	t1: number;
	t2: number;
	matchResult: string;
	isMatchOver: boolean;
}

export interface ApprovalRequestMsg {
	action: 'APPROVAL_REQUEST';
	requests: string[];
}

export interface WaitingApprovalMsg {
	action: 'WAITING_APPROVAL';
}

export interface RejectedMsg {
	action: 'REJECTED';
}

export interface ErrorMsg {
	action: 'ERROR';
	message: string;
}

export type ServerMessage =
	| GameStateUpdateMsg
	| GameOverMsg
	| ApprovalRequestMsg
	| WaitingApprovalMsg
	| RejectedMsg
	| ErrorMsg;

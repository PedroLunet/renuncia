import type { Card, Rank, Suit } from './types';

// ─── Rank power table used for trick evaluation ───────────────────────────────
// Higher number = beats lower in the same suit category.
export const RANK_POWER: Record<Rank, number> = {
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

// ─── The full 40-card Portuguese (Sueca) deck ─────────────────────────────────
const DECK_DEFINITION: { rank: Rank; value: number }[] = [
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

const SUITS: Suit[] = ['copas', 'espadas', 'ouros', 'paus'];

/** Returns a fresh, ordered 40-card deck. */
export function generateDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const { rank, value } of DECK_DEFINITION) {
			deck.push({ suit, rank, value });
		}
	}
	return deck;
}

/** Fisher-Yates in-place shuffle. */
export function shuffleDeck(deck: Card[]): void {
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
}

/**
 * Deal 10 cards to each of the 4 players from the shuffled deck.
 * Returns the per-player hands keyed by player id.
 */
export function dealHands(deck: Card[], playerIds: string[]): Record<string, Card[]> {
	const hands: Record<string, Card[]> = {};
	for (let i = 0; i < 4; i++) {
		hands[playerIds[i]] = deck.slice(i * 10, i * 10 + 10);
	}
	return hands;
}

import { RANK_POWER } from './deck';
import type { Card, PlayedCard } from './types';

// ─── Trick evaluation ─────────────────────────────────────────────────────────

/**
 * Returns the player id of the trick winner.
 *
 * Rules (Sueca):
 *  - Trump cards beat any non-trump card.
 *  - Among cards of the same category (trump vs lead-suit), rank power decides.
 *  - Cards of off-suits that are not trump have zero power and can never win.
 */
export function evaluateTrickWinner(trick: PlayedCard[], trumpSuit: Card['suit']): string {
	const leadSuit = trick[0].card.suit;

	let winningPlay = trick[0];
	let maxPower = -1;

	for (const play of trick) {
		let power = 0;
		if (play.card.suit === trumpSuit) {
			power = 1000 + RANK_POWER[play.card.rank];
		} else if (play.card.suit === leadSuit) {
			power = 100 + RANK_POWER[play.card.rank];
		}

		if (power > maxPower) {
			maxPower = power;
			winningPlay = play;
		}
	}

	return winningPlay.playerId;
}

// ─── Round scoring ────────────────────────────────────────────────────────────

export interface RoundResult {
	/** Match points earned this round by team 1 (0-4). */
	team1RoundPoints: number;
	/** Match points earned this round by team 2 (0-4). */
	team2RoundPoints: number;
	/** Human-readable summary for the GAME_OVER message. */
	summary: string;
}

/**
 * Given the card-point totals at the end of a round, returns how many
 * match points each team earns and a display summary.
 *
 * Sueca match-point scale:
 *  - Win with > 60 pts   → 1 match point
 *  - Win with > 90 pts   → 2 match points
 *  - Win all 120 pts     → 4 match points
 *  - 60 – 60 tie         → 0 points each
 */
export function calculateRoundPoints(team1Points: number, team2Points: number): RoundResult {
	if (team1Points > 60) {
		const pts = team1Points === 120 ? 4 : team1Points > 90 ? 2 : 1;
		return {
			team1RoundPoints: pts,
			team2RoundPoints: 0,
			summary: `Team 1 wins ${pts} match point(s)!`
		};
	}

	if (team2Points > 60) {
		const pts = team2Points === 120 ? 4 : team2Points > 90 ? 2 : 1;
		return {
			team1RoundPoints: 0,
			team2RoundPoints: pts,
			summary: `Team 2 wins ${pts} match point(s)!`
		};
	}

	return {
		team1RoundPoints: 0,
		team2RoundPoints: 0,
		summary: 'Draw! 60 - 60.'
	};
}

// ─── Match-over detection ─────────────────────────────────────────────────────

export const MATCH_POINTS_TO_WIN = 4;

/** Returns true when a team has reached the winning threshold. */
export function isMatchOver(team1MatchPoints: number, team2MatchPoints: number): boolean {
	return team1MatchPoints >= MATCH_POINTS_TO_WIN || team2MatchPoints >= MATCH_POINTS_TO_WIN;
}

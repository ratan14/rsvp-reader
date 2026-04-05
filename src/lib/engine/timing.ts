import { isSentenceEnd, isClauseEnd, isNumeric } from './punctuation';

function tierMultiplier(length: number): number {
	if (length <= 2) return 0.9;
	if (length <= 8) return 1.0;
	return 1.3;
}

/**
 * Calculate display delay in milliseconds for a word.
 * Uses research-backed tiered multipliers and punctuation pauses.
 */
export function calculateDelay(
	word: string,
	wpm: number,
	variableSpeed: boolean,
	pauseAtPunctuation: boolean,
	isParagraphBreak?: boolean
): number {
	const baseDelay = Math.round(60000 / wpm);

	if (isParagraphBreak) {
		return Math.round(baseDelay * 1.8);
	}

	let factor = 1.0;

	if (variableSpeed) {
		factor *= tierMultiplier(word.length);
	}

	if (pauseAtPunctuation) {
		if (isSentenceEnd(word)) {
			factor *= 2.5;
		} else if (isClauseEnd(word)) {
			factor *= 1.5;
		} else if (isNumeric(word)) {
			factor *= 1.5;
		}
	}

	return Math.round(baseDelay * factor);
}

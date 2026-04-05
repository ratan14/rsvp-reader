/**
 * Calculate the Optimal Recognition Point (ORP) for a word.
 * Returns the 0-based character index where the eye should fixate.
 * Approximately 1/3 from the left, adjusted for short words.
 */
export function calculateOrp(word: string): number {
	const len = word.length;
	if (len <= 0) return 0;
	if (len <= 3) return Math.max(0, len - 2);
	return Math.floor(len * 0.33);
}

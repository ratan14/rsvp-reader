/**
 * Calculate the Optimal Viewing Position (OVP) for a word.
 * Returns the 0-based character index within the full token where the eye should fixate.
 *
 * Only letters (A-Z) count toward word length for the lookup table.
 * The returned index maps the Nth letter position back to its position
 * in the original token (which may include quotes, punctuation, etc).
 *
 * Uses the lookup table from pasky/speedread and n-ivkovic/tspreed.
 *
 * | Letter count | OVP (0-indexed among letters) |
 * |--------------|-------------------------------|
 * | 1-2          | 0                             |
 * | 3-6          | 1                             |
 * | 7-10         | 2                             |
 * | 11-13        | 3                             |
 * | 14+          | 4                             |
 */
const OVP_TABLE = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3];

export function calculateOrp(word: string): number {
	if (!word) return 0;

	// Find positions of all letters in the token
	const letterIndices: number[] = [];
	for (let i = 0; i < word.length; i++) {
		if (/[a-zA-Z]/.test(word[i])) {
			letterIndices.push(i);
		}
	}

	const letterCount = letterIndices.length;
	if (letterCount === 0) {
		// No letters (e.g. "..." or "—") — focal point at first char
		return 0;
	}

	// Look up which letter (0-indexed among letters only) to focus on
	const letterOrp = letterCount <= OVP_TABLE.length
		? OVP_TABLE[letterCount - 1]
		: 4;

	// Map back to position in the full token
	const clampedOrp = Math.min(letterOrp, letterIndices.length - 1);
	return letterIndices[clampedOrp];
}

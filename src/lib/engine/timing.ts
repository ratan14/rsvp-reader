/**
 * Calculate display delay in milliseconds for a word.
 * Adjusts base WPM delay by word length and punctuation.
 */
export function calculateDelay(
	word: string,
	wpm: number,
	variableSpeed: boolean,
	pauseAtPunctuation: boolean
): number {
	let delay = Math.round(60000 / wpm);

	if (variableSpeed) {
		let factor = word.length / 5.0;
		factor = Math.max(0.8, Math.min(2.0, factor));
		delay = Math.round(delay * factor);
	}

	if (pauseAtPunctuation) {
		const lastChar = word.charAt(word.length - 1);
		if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
			delay = Math.round(delay * 2.0);
		} else if (lastChar === ',' || lastChar === ';' || lastChar === ':') {
			delay = Math.round(delay * 1.5);
		}
	}

	return delay;
}

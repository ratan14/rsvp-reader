import type { Token, Chapter } from '$lib/types';
import { calculateOrp } from './orp';

/**
 * Parse raw text into an array of Tokens.
 * Optionally assigns chapter indices based on character offsets.
 */
export function parseText(text: string, chapters?: Chapter[]): Token[] {
	if (!text.trim()) return [];

	const tokens: Token[] = [];
	let tokenIndex = 0;

	const regex = /\S+/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		const word = match[0];
		const wordCharPos = match.index;

		let chapterIndex: number | undefined;
		if (chapters && chapters.length > 0) {
			for (let i = chapters.length - 1; i >= 0; i--) {
				if (wordCharPos >= chapters[i].charOffset) {
					chapterIndex = i;
					break;
				}
			}
		}

		tokens.push({
			text: word,
			index: tokenIndex,
			chapterIndex,
			orp: calculateOrp(word)
		});
		tokenIndex++;
	}

	return tokens;
}

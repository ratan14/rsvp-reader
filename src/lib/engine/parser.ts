import type { Token, Chapter } from '$lib/types';
import { calculateOrp } from './orp';

const HYPHEN_SPLIT_THRESHOLD = 13;

/**
 * Parse raw text into an array of Tokens.
 * Detects paragraph boundaries (double newlines) and inserts marker tokens.
 * Splits long hyphenated words (>13 chars) at hyphens.
 * Optionally assigns chapter indices based on character offsets.
 */
export function parseText(text: string, chapters?: Chapter[]): Token[] {
	if (!text.trim()) return [];

	// Step 1: Find paragraph boundary positions before normalizing whitespace.
	// A paragraph boundary is one or more blank lines (\n followed by optional
	// whitespace and another \n). Record the char position of the first \n.
	const paragraphBreaks = new Set<number>();
	const breakRegex = /\n[ \t]*\n/g;
	let breakMatch: RegExpExecArray | null;
	const seen = new Set<number>();
	while ((breakMatch = breakRegex.exec(text)) !== null) {
		// Deduplicate consecutive breaks: only record if we haven't marked
		// a break within this contiguous whitespace region.
		const pos = breakMatch.index;
		if (!seen.has(pos)) {
			paragraphBreaks.add(pos);
			seen.add(pos);
		}
	}

	// Step 2: Normalize whitespace for tokenization.
	const normalized = text.replace(/[^\S ]/g, ' ')
		.replace(/[\u00A0-\u00AD\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2066-\u206F\u3000\uFEFF]/g, ' ');

	// Step 3: Tokenize and track which paragraph boundaries fall between tokens.
	const tokens: Token[] = [];
	let tokenIndex = 0;
	let lastTokenEndPos = 0;

	const regex = /\S+/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(normalized)) !== null) {
		const word = match[0];
		const wordCharPos = match.index;

		// Check if any paragraph break falls between the last token and this one.
		// Only insert if there was a previous token (no leading break markers).
		if (tokens.length > 0) {
			let hasParagraphBreak = false;
			for (const bp of paragraphBreaks) {
				if (bp >= lastTokenEndPos && bp < wordCharPos) {
					hasParagraphBreak = true;
					break;
				}
			}
			if (hasParagraphBreak) {
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
					text: '',
					index: tokenIndex,
					chapterIndex,
					orp: 0,
					isParagraphBreak: true
				});
				tokenIndex++;
			}
		}

		lastTokenEndPos = wordCharPos + word.length;

		// Step 4: Hybrid hyphen splitting.
		const parts = (word.includes('-') && word.length > HYPHEN_SPLIT_THRESHOLD)
			? word.split('-').filter(p => p.length > 0)
			: [word];

		for (const part of parts) {
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
				text: part,
				index: tokenIndex,
				chapterIndex,
				orp: calculateOrp(part)
			});
			tokenIndex++;
		}
	}

	return tokens;
}

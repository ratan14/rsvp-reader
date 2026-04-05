/**
 * Find the trailing punctuation character in a token, looking past
 * closing quotes, brackets, and other wrapper characters.
 *
 * Examples:
 *   "hello."   → "."
 *   'they?"'   → "?"
 *   "said,"    → ","
 *   "word"     → "d"
 *   'end."'    → "."
 *   'end.\u2019'  → "."
 *   "away..."  → "."
 *   "away\u2026"  → "\u2026"
 *   "really?!" → "!"
 */
const TRAILING_WRAPPERS = new Set([
	'"', "'", ')', ']', '}',
	'\u201D',  // " right double curly
	'\u2019',  // ' right single curly
	'\u00BB',  // » right guillemet
]);

const LEADING_WRAPPERS = new Set([
	'"', "'", '(', '[', '{',
	'\u201C',  // " left double curly
	'\u2018',  // ' left single curly
	'\u00AB',  // « left guillemet
]);

export function stripWrappers(word: string): string {
	let start = 0;
	let end = word.length - 1;
	while (start <= end && LEADING_WRAPPERS.has(word[start])) start++;
	while (end >= start && TRAILING_WRAPPERS.has(word[end])) end--;
	return word.slice(start, end + 1);
}

export function trailingPunctuation(word: string): string {
	for (let i = word.length - 1; i >= 0; i--) {
		const ch = word[i];
		if (TRAILING_WRAPPERS.has(ch)) continue;
		return ch;
	}
	return '';
}

const ABBREVIATIONS = new Set([
	'dr.', 'mr.', 'mrs.', 'ms.', 'jr.', 'sr.', 'st.', 'vs.',
	'etc.', 'approx.', 'prof.', 'gen.', 'gov.',
	'corp.', 'inc.', 'ltd.', 'vol.', 'no.', 'fig.',
]);

const LETTER_DOT_PATTERN = /^([a-zA-Z]\.){2,}$/;

export function isLikelyAbbreviation(word: string): boolean {
	const core = stripWrappers(word);
	if (!core) return false;
	if (LETTER_DOT_PATTERN.test(core)) return true;
	if (ABBREVIATIONS.has(core.toLowerCase())) return true;
	return false;
}

const CURRENCY_SYMBOLS = /[$€£¥]/g;
const NUMERIC_PATTERN = /^\d[\d.,/:%-]*$/;

export function isNumeric(word: string): boolean {
	const core = stripWrappers(word).replace(CURRENCY_SYMBOLS, '');
	if (!core) return false;
	return NUMERIC_PATTERN.test(core);
}

const SENTENCE_ENDERS = new Set(['.', '?', '!', '\u2026']); // includes … (ellipsis)

export function isSentenceEnd(word: string): boolean {
	const ch = trailingPunctuation(word);
	if (!SENTENCE_ENDERS.has(ch)) return false;
	if (isLikelyAbbreviation(word)) return false;
	return true;
}

export function isClauseEnd(word: string): boolean {
	const ch = trailingPunctuation(word);
	return ch === ',' || ch === ';' || ch === ':' || ch === '\u2014' || ch === '\u2013';
	// \u2014 = em dash, \u2013 = en dash
}

# RSVP Research-Aligned Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply academic RSVP research findings to improve timing accuracy, fix punctuation edge cases, add paragraph pauses, and handle long hyphenated words.

**Architecture:** All changes are in the engine layer (`src/lib/engine/`) and types (`src/lib/types.ts`). Pure functions with unit tests. No UI, importer, or storage changes.

**Tech Stack:** TypeScript, Vitest, SvelteKit (engine layer only)

**Test command:** `npx vitest run --reporter=verbose`

**Baseline:** 111 tests passing across 11 files.

---

### Task 1: Add `isParagraphBreak` to Token type

**Files:**
- Modify: `src/lib/types.ts:1-6`

- [ ] **Step 1: Add the field**

In `src/lib/types.ts`, add `isParagraphBreak` to the `Token` interface:

```typescript
export interface Token {
	text: string;
	index: number;
	chapterIndex?: number;
	orp: number;
	isParagraphBreak?: boolean;
}
```

- [ ] **Step 2: Run tests to verify nothing breaks**

Run: `npx vitest run --reporter=verbose`
Expected: All 111 tests pass (adding an optional field is backward-compatible).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add isParagraphBreak field to Token type"
```

---

### Task 2: Add abbreviation and numeric detection to punctuation module

**Files:**
- Modify: `src/lib/engine/punctuation.ts`
- Modify: `tests/lib/engine/punctuation.test.ts`

- [ ] **Step 1: Write failing tests for `stripWrappers`**

Append to `tests/lib/engine/punctuation.test.ts`:

```typescript
import { stripWrappers, isLikelyAbbreviation, isNumeric } from '$lib/engine/punctuation';

describe('stripWrappers', () => {
	it('returns plain word unchanged', () => {
		expect(stripWrappers('hello')).toBe('hello');
	});

	it('strips trailing quote', () => {
		expect(stripWrappers('Dr."')).toBe('Dr.');
	});

	it('strips leading and trailing quotes', () => {
		expect(stripWrappers('"Dr."')).toBe('Dr.');
	});

	it('strips curly quotes', () => {
		expect(stripWrappers('\u201CDr.\u201D')).toBe('Dr.');
	});

	it('strips parens', () => {
		expect(stripWrappers('(hello)')).toBe('hello');
	});

	it('returns empty for wrapper-only token', () => {
		expect(stripWrappers('"\u201D')).toBe('');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: FAIL — `stripWrappers` is not exported.

- [ ] **Step 3: Implement `stripWrappers`**

In `src/lib/engine/punctuation.ts`, add after the `TRAILING_WRAPPERS` set (before `trailingPunctuation`):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: All `stripWrappers` tests pass.

- [ ] **Step 5: Write failing tests for `isLikelyAbbreviation`**

Append to `tests/lib/engine/punctuation.test.ts`:

```typescript
describe('isLikelyAbbreviation', () => {
	it('detects single-letter-dot pattern U.S.A.', () => {
		expect(isLikelyAbbreviation('U.S.A.')).toBe(true);
	});

	it('detects e.g.', () => {
		expect(isLikelyAbbreviation('e.g.')).toBe(true);
	});

	it('detects i.e.', () => {
		expect(isLikelyAbbreviation('i.e.')).toBe(true);
	});

	it('detects a.m.', () => {
		expect(isLikelyAbbreviation('a.m.')).toBe(true);
	});

	it('detects common title Dr.', () => {
		expect(isLikelyAbbreviation('Dr.')).toBe(true);
	});

	it('detects Mr.', () => {
		expect(isLikelyAbbreviation('Mr.')).toBe(true);
	});

	it('detects Mrs.', () => {
		expect(isLikelyAbbreviation('Mrs.')).toBe(true);
	});

	it('detects etc.', () => {
		expect(isLikelyAbbreviation('etc.')).toBe(true);
	});

	it('detects Corp.', () => {
		expect(isLikelyAbbreviation('Corp.')).toBe(true);
	});

	it('detects abbreviation through quotes', () => {
		expect(isLikelyAbbreviation('"Dr."')).toBe(true);
	});

	it('detects abbreviation through curly quotes', () => {
		expect(isLikelyAbbreviation('\u201CDr.\u201D')).toBe(true);
	});

	it('returns false for regular word with period', () => {
		expect(isLikelyAbbreviation('hello.')).toBe(false);
	});

	it('returns false for sentence-ending word', () => {
		expect(isLikelyAbbreviation('end.')).toBe(false);
	});

	it('returns false for plain word', () => {
		expect(isLikelyAbbreviation('hello')).toBe(false);
	});

	it('returns false for question mark', () => {
		expect(isLikelyAbbreviation('what?')).toBe(false);
	});
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: FAIL — `isLikelyAbbreviation` is not a function.

- [ ] **Step 7: Implement `isLikelyAbbreviation`**

In `src/lib/engine/punctuation.ts`, add after `stripWrappers`:

```typescript
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: All `isLikelyAbbreviation` tests pass.

- [ ] **Step 9: Write failing tests for `isNumeric`**

Append to `tests/lib/engine/punctuation.test.ts`:

```typescript
describe('isNumeric', () => {
	it('detects plain integer', () => {
		expect(isNumeric('42')).toBe(true);
	});

	it('detects decimal', () => {
		expect(isNumeric('3.99')).toBe(true);
	});

	it('detects currency', () => {
		expect(isNumeric('$3.99')).toBe(true);
	});

	it('detects euro currency', () => {
		expect(isNumeric('€100')).toBe(true);
	});

	it('detects thousands separator', () => {
		expect(isNumeric('3,000')).toBe(true);
	});

	it('detects percentage', () => {
		expect(isNumeric('50%')).toBe(true);
	});

	it('detects time', () => {
		expect(isNumeric('12:30')).toBe(true);
	});

	it('detects fraction', () => {
		expect(isNumeric('1/2')).toBe(true);
	});

	it('detects number in parens', () => {
		expect(isNumeric('(42)')).toBe(true);
	});

	it('detects number in quotes', () => {
		expect(isNumeric('"100"')).toBe(true);
	});

	it('detects year', () => {
		expect(isNumeric('2026')).toBe(true);
	});

	it('returns false for plain word', () => {
		expect(isNumeric('hello')).toBe(false);
	});

	it('returns false for alphanumeric like h2o', () => {
		expect(isNumeric('h2o')).toBe(false);
	});

	it('returns false for ordinal like 4th', () => {
		expect(isNumeric('4th')).toBe(false);
	});

	it('returns false for mixed like COVID-19', () => {
		expect(isNumeric('COVID-19')).toBe(false);
	});
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: FAIL — `isNumeric` is not a function.

- [ ] **Step 11: Implement `isNumeric`**

In `src/lib/engine/punctuation.ts`, add after `isLikelyAbbreviation`:

```typescript
const CURRENCY_SYMBOLS = /[$€£¥]/g;
const NUMERIC_PATTERN = /^\d[\d.,/:%-]*$/;

export function isNumeric(word: string): boolean {
	const core = stripWrappers(word).replace(CURRENCY_SYMBOLS, '');
	if (!core) return false;
	return NUMERIC_PATTERN.test(core);
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: All `isNumeric` tests pass.

- [ ] **Step 13: Write failing test for abbreviation fix in `isSentenceEnd`**

Append to the existing `isSentenceEnd` describe block in `tests/lib/engine/punctuation.test.ts`:

```typescript
	it('returns false for abbreviation Dr.', () => {
		expect(isSentenceEnd('Dr.')).toBe(false);
	});

	it('returns false for abbreviation U.S.A.', () => {
		expect(isSentenceEnd('U.S.A.')).toBe(false);
	});

	it('returns false for abbreviation etc.', () => {
		expect(isSentenceEnd('etc.')).toBe(false);
	});

	it('returns false for quoted abbreviation', () => {
		expect(isSentenceEnd('"Dr."')).toBe(false);
	});

	it('still returns true for regular sentence end', () => {
		expect(isSentenceEnd('done.')).toBe(true);
	});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run tests/lib/engine/punctuation.test.ts --reporter=verbose`
Expected: FAIL — `isSentenceEnd('Dr.')` returns `true` but expected `false`.

- [ ] **Step 15: Update `isSentenceEnd` to check for abbreviations**

In `src/lib/engine/punctuation.ts`, modify `isSentenceEnd`:

```typescript
export function isSentenceEnd(word: string): boolean {
	const ch = trailingPunctuation(word);
	if (!SENTENCE_ENDERS.has(ch)) return false;
	if (isLikelyAbbreviation(word)) return false;
	return true;
}
```

- [ ] **Step 16: Run all tests to verify everything passes**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass (111 existing + new punctuation tests).

- [ ] **Step 17: Commit**

```bash
git add src/lib/engine/punctuation.ts tests/lib/engine/punctuation.test.ts
git commit -m "feat: add abbreviation and numeric detection to punctuation module

- stripWrappers helper for stripping leading/trailing quotes and brackets
- isLikelyAbbreviation detects Dr., U.S.A., etc. patterns
- isNumeric detects numeric tokens like $3.99, 50%, 12:30
- isSentenceEnd now returns false for abbreviations"
```

---

### Task 3: Overhaul timing with research-backed tiers

**Files:**
- Modify: `src/lib/engine/timing.ts`
- Modify: `tests/lib/engine/timing.test.ts`

- [ ] **Step 1: Rewrite timing tests for new behavior**

Replace the entire contents of `tests/lib/engine/timing.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDelay } from '$lib/engine/timing';

describe('calculateDelay', () => {
	const baseWpm = 300; // base delay = 200ms

	describe('base delay', () => {
		it('returns base delay with no adjustments', () => {
			expect(calculateDelay('hello', baseWpm, false, false)).toBe(200);
		});

		it('scales with WPM', () => {
			expect(calculateDelay('hello', 600, false, false)).toBe(100);
		});
	});

	describe('variable speed tiers', () => {
		it('applies 0.9x for 1-char words', () => {
			expect(calculateDelay('I', baseWpm, true, false)).toBe(180);
		});

		it('applies 0.9x for 2-char words', () => {
			expect(calculateDelay('at', baseWpm, true, false)).toBe(180);
		});

		it('applies 1.0x for 3-char words', () => {
			expect(calculateDelay('the', baseWpm, true, false)).toBe(200);
		});

		it('applies 1.0x for 5-char words', () => {
			expect(calculateDelay('hello', baseWpm, true, false)).toBe(200);
		});

		it('applies 1.0x for 8-char words', () => {
			expect(calculateDelay('xxxxxxxx', baseWpm, true, false)).toBe(200);
		});

		it('applies 1.3x for 9-char words', () => {
			expect(calculateDelay('xxxxxxxxx', baseWpm, true, false)).toBe(260);
		});

		it('applies 1.3x for long words', () => {
			expect(calculateDelay('extraordinary', baseWpm, true, false)).toBe(260);
		});
	});

	describe('punctuation pauses', () => {
		it('applies 2.5x for sentence-ending period', () => {
			expect(calculateDelay('end.', baseWpm, false, true)).toBe(500);
		});

		it('applies 2.5x for question mark', () => {
			expect(calculateDelay('why?', baseWpm, false, true)).toBe(500);
		});

		it('applies 2.5x for exclamation mark', () => {
			expect(calculateDelay('wow!', baseWpm, false, true)).toBe(500);
		});

		it('applies 1.5x for comma', () => {
			expect(calculateDelay('however,', baseWpm, false, true)).toBe(300);
		});

		it('applies 1.5x for semicolon', () => {
			expect(calculateDelay('first;', baseWpm, false, true)).toBe(300);
		});

		it('applies 1.5x for colon', () => {
			expect(calculateDelay('note:', baseWpm, false, true)).toBe(300);
		});

		it('detects sentence end through closing quote', () => {
			expect(calculateDelay('they?"', baseWpm, false, true)).toBe(500);
		});

		it('detects comma through closing quote', () => {
			expect(calculateDelay('said,"', baseWpm, false, true)).toBe(300);
		});

		it('detects period through closing curly quote', () => {
			expect(calculateDelay('end.\u201D', baseWpm, false, true)).toBe(500);
		});

		it('ignores punctuation when pauseAtPunctuation is false', () => {
			expect(calculateDelay('end.', baseWpm, false, false)).toBe(200);
		});

		it('does not pause for abbreviations', () => {
			expect(calculateDelay('Dr.', baseWpm, false, true)).toBe(200);
		});

		it('does not pause for U.S.A.', () => {
			expect(calculateDelay('U.S.A.', baseWpm, false, true)).toBe(200);
		});
	});

	describe('numeric delay', () => {
		it('applies 1.5x for plain number', () => {
			expect(calculateDelay('42', baseWpm, false, true)).toBe(300);
		});

		it('applies 1.5x for currency amount', () => {
			expect(calculateDelay('$3.99', baseWpm, false, true)).toBe(300);
		});

		it('applies 1.5x for year', () => {
			expect(calculateDelay('2026', baseWpm, false, true)).toBe(300);
		});

		it('does not apply numeric delay when pauseAtPunctuation is false', () => {
			expect(calculateDelay('42', baseWpm, false, false)).toBe(200);
		});

		it('sentence-end takes priority over numeric delay', () => {
			// "99." — ends with period, is not abbreviation
			expect(calculateDelay('99.', baseWpm, false, true)).toBe(500);
		});
	});

	describe('stacking variable speed and punctuation', () => {
		it('stacks variable speed tier with sentence pause', () => {
			// "end." = 4 chars = 1.0x tier, sentence = 2.5x => 200 * 1.0 * 2.5 = 500
			expect(calculateDelay('end.', baseWpm, true, true)).toBe(500);
		});

		it('stacks short word tier with clause pause', () => {
			// "so," = 3 chars = 1.0x tier, clause = 1.5x => 200 * 1.0 * 1.5 = 300
			expect(calculateDelay('so,', baseWpm, true, true)).toBe(300);
		});

		it('stacks long word tier with no punctuation', () => {
			// "extremely!" = 10 chars = 1.3x tier, sentence = 2.5x => 200 * 1.3 * 2.5 = 650
			expect(calculateDelay('extremely!', baseWpm, true, true)).toBe(650);
		});
	});

	describe('paragraph break', () => {
		it('returns base * 1.8 for paragraph break', () => {
			expect(calculateDelay('', baseWpm, false, false, true)).toBe(360);
		});

		it('ignores variableSpeed for paragraph break', () => {
			expect(calculateDelay('', baseWpm, true, false, true)).toBe(360);
		});

		it('ignores pauseAtPunctuation for paragraph break', () => {
			expect(calculateDelay('', baseWpm, false, true, true)).toBe(360);
		});

		it('scales with WPM for paragraph break', () => {
			expect(calculateDelay('', 600, false, false, true)).toBe(180);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/engine/timing.test.ts --reporter=verbose`
Expected: Multiple failures — old behavior doesn't match new expected values.

- [ ] **Step 3: Rewrite `calculateDelay` implementation**

Replace the entire contents of `src/lib/engine/timing.ts` with:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/engine/timing.test.ts --reporter=verbose`
Expected: All timing tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass. Some existing tests in other files that relied on old timing values may still reference old behavior via the reader engine — check for failures and note them (they'll be fixed in later tasks if any).

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/timing.ts tests/lib/engine/timing.test.ts
git commit -m "feat: overhaul timing with research-backed tiers

- Replace linear length/5 formula with 3 tiers: 0.9x (1-2 chars), 1.0x (3-8), 1.3x (9+)
- Increase sentence-end pause from 2.0x to 2.5x
- Add 1.5x numeric token delay under pauseAtPunctuation
- Add 1.8x paragraph break delay via isParagraphBreak flag"
```

---

### Task 4: Add paragraph detection and hybrid hyphen splitting to parser

**Files:**
- Modify: `src/lib/engine/parser.ts`
- Modify: `tests/lib/engine/parser.test.ts`

- [ ] **Step 1: Write failing tests for paragraph detection**

Append to the `parseText` describe block in `tests/lib/engine/parser.test.ts`:

```typescript
	it('inserts paragraph break marker at double newline', () => {
		const tokens = parseText('hello world\n\nfoo bar');
		expect(tokens).toHaveLength(5); // hello, world, <break>, foo, bar
		expect(tokens[2].isParagraphBreak).toBe(true);
		expect(tokens[2].text).toBe('');
		expect(tokens[2].orp).toBe(0);
	});

	it('inserts single marker for consecutive blank lines', () => {
		const tokens = parseText('hello\n\n\n\nworld');
		const breaks = tokens.filter(t => t.isParagraphBreak);
		expect(breaks).toHaveLength(1);
	});

	it('does not insert marker for single newline', () => {
		const tokens = parseText('hello\nworld');
		const breaks = tokens.filter(t => t.isParagraphBreak);
		expect(breaks).toHaveLength(0);
		expect(tokens).toHaveLength(2);
	});

	it('handles multiple paragraphs', () => {
		const tokens = parseText('aaa bbb\n\nccc ddd\n\neee fff');
		const breaks = tokens.filter(t => t.isParagraphBreak);
		expect(breaks).toHaveLength(2);
		expect(tokens).toHaveLength(8); // 6 words + 2 breaks
	});

	it('assigns chapter index to paragraph markers', () => {
		const text = 'aaa\n\nbbb';
		const chapters = [{ title: 'Ch1', charOffset: 0 }];
		const tokens = parseText(text, chapters);
		const breakToken = tokens.find(t => t.isParagraphBreak);
		expect(breakToken?.chapterIndex).toBe(0);
	});

	it('does not insert marker for leading/trailing blank lines', () => {
		const tokens = parseText('\n\nhello world\n\n');
		const breaks = tokens.filter(t => t.isParagraphBreak);
		expect(breaks).toHaveLength(0);
		expect(tokens).toHaveLength(2);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/engine/parser.test.ts --reporter=verbose`
Expected: FAIL — paragraph tests fail because no markers are inserted. Also note the existing test `'handles multiple whitespace and newlines'` expects 4 tokens for `'hello   world\n\nfoo   bar'` but after this change it will need to expect 5 (with a paragraph break). We'll handle that in step 5.

- [ ] **Step 3: Write failing tests for hybrid hyphen splitting**

Append to the `parseText` describe block in `tests/lib/engine/parser.test.ts`:

```typescript
	it('keeps short hyphenated words intact', () => {
		const tokens = parseText('well-known fact');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].text).toBe('well-known');
	});

	it('keeps 13-char hyphenated words intact (at threshold)', () => {
		const tokens = parseText('mother-in-law'); // exactly 13 chars
		expect(tokens).toHaveLength(1);
		expect(tokens[0].text).toBe('mother-in-law');
	});

	it('splits hyphenated words over 13 chars', () => {
		const tokens = parseText('commander-in-chief'); // 18 chars
		expect(tokens).toHaveLength(3);
		expect(tokens[0].text).toBe('commander');
		expect(tokens[1].text).toBe('in');
		expect(tokens[2].text).toBe('chief');
	});

	it('calculates ORP independently for split tokens', () => {
		const tokens = parseText('commander-in-chief');
		// "commander" = 9 letters -> ORP index 2
		expect(tokens[0].orp).toBe(2);
		// "in" = 2 letters -> ORP index 0
		expect(tokens[1].orp).toBe(0);
		// "chief" = 5 letters -> ORP index 1
		expect(tokens[2].orp).toBe(1);
	});

	it('discards empty segments from double hyphens', () => {
		const tokens = parseText('something--very--long--here'); // 26 chars, has double hyphens
		const nonEmpty = tokens.filter(t => t.text !== '');
		expect(nonEmpty.length).toBeGreaterThan(1);
		expect(nonEmpty.every(t => t.text.length > 0)).toBe(true);
	});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/lib/engine/parser.test.ts --reporter=verbose`
Expected: FAIL — hyphen tests fail because splitting is not implemented.

- [ ] **Step 5: Implement paragraph detection and hyphen splitting**

Replace the entire contents of `src/lib/engine/parser.ts` with:

```typescript
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
```

- [ ] **Step 6: Update the existing test that conflicts**

The existing test `'handles multiple whitespace and newlines'` uses `'hello   world\n\nfoo   bar'` and expects 4 tokens. Now it should expect 5 (with a paragraph break). Update it in `tests/lib/engine/parser.test.ts`:

```typescript
	it('handles multiple whitespace and newlines', () => {
		const tokens = parseText('hello   world\n\nfoo   bar');
		expect(tokens).toHaveLength(5); // hello, world, <break>, foo, bar
		expect(tokens.filter(t => !t.isParagraphBreak).map((t) => t.text)).toEqual(['hello', 'world', 'foo', 'bar']);
	});
```

- [ ] **Step 7: Run parser tests**

Run: `npx vitest run tests/lib/engine/parser.test.ts --reporter=verbose`
Expected: All parser tests pass.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/engine/parser.ts tests/lib/engine/parser.test.ts
git commit -m "feat: add paragraph detection and hybrid hyphen splitting

- Detect double-newline paragraph boundaries, insert marker tokens
- Consecutive blank lines produce a single marker
- Split hyphenated words >13 chars at hyphens into separate tokens
- Each sub-token gets independent ORP calculation"
```

---

### Task 5: Update reader engine to handle paragraph tokens

**Files:**
- Modify: `src/lib/engine/reader-engine.svelte.ts`
- Modify: `tests/lib/engine/reader-engine.test.ts`

- [ ] **Step 1: Write failing tests for paragraph break in playback**

Add to the `createReaderEngine` describe block in `tests/lib/engine/reader-engine.test.ts`. First update the `makeTokens` helper and add a new helper, then add tests:

At the top of the describe block, after the existing `makeTokens` function, add:

```typescript
function makeParagraphToken(index: number): Token {
	return { text: '', index, orp: 0, isParagraphBreak: true };
}
```

Then append these tests inside the describe block:

```typescript
	it('pauses at paragraph break without changing displayed word', () => {
		const engine = createReaderEngine();
		const tokens: Token[] = [
			{ text: 'hello', index: 0, orp: 0 },
			{ text: '', index: 1, orp: 0, isParagraphBreak: true },
			{ text: 'world', index: 2, orp: 0 },
		];
		engine.loadTokens(tokens);
		engine.wpm = 300;
		engine.variableSpeed = false;
		engine.pauseAtPunctuation = false;
		engine.play();

		// After first word delay (200ms), should advance past paragraph break
		vi.advanceTimersByTime(200);
		// Now at paragraph break (index 1), word display should still be previous
		// After paragraph delay (360ms), should be at 'world'
		vi.advanceTimersByTime(360);
		expect(engine.currentWord).toBe('world');
	});

	it('skipForward skips over paragraph tokens', () => {
		const engine = createReaderEngine();
		const tokens: Token[] = [
			{ text: 'hello', index: 0, orp: 0 },
			{ text: '', index: 1, orp: 0, isParagraphBreak: true },
			{ text: 'world', index: 2, orp: 0 },
		];
		engine.loadTokens(tokens);
		engine.skipForward(1);
		// Should skip past the paragraph break to 'world'
		expect(engine.currentWord).toBe('world');
	});

	it('skipBack skips over paragraph tokens', () => {
		const engine = createReaderEngine();
		const tokens: Token[] = [
			{ text: 'hello', index: 0, orp: 0 },
			{ text: '', index: 1, orp: 0, isParagraphBreak: true },
			{ text: 'world', index: 2, orp: 0 },
		];
		engine.loadTokens(tokens);
		engine.seekTo(1.0); // go to end
		engine.skipBack(1);
		// Should skip past the paragraph break to 'hello'
		expect(engine.currentWord).toBe('hello');
	});

	it('nextSentence skips paragraph break tokens', () => {
		const engine = createReaderEngine();
		const tokens: Token[] = [
			{ text: 'Hello', index: 0, orp: 0 },
			{ text: 'world.', index: 1, orp: 0 },
			{ text: '', index: 2, orp: 0, isParagraphBreak: true },
			{ text: 'New', index: 3, orp: 0 },
			{ text: 'sentence.', index: 4, orp: 0 },
		];
		engine.loadTokens(tokens);
		engine.nextSentence();
		// Should land on 'New' (index 3), not on the paragraph break
		expect(engine.currentWord).toBe('New');
	});

	it('prevSentence skips paragraph break tokens', () => {
		const engine = createReaderEngine();
		const tokens: Token[] = [
			{ text: 'First.', index: 0, orp: 0 },
			{ text: '', index: 1, orp: 0, isParagraphBreak: true },
			{ text: 'Second', index: 2, orp: 0 },
			{ text: 'here.', index: 3, orp: 0 },
		];
		engine.loadTokens(tokens);
		engine.seekTo(0.75); // near 'here.'
		engine.prevSentence();
		// Should land on 'Second' (index 2), not on the paragraph break
		expect(engine.currentWord).toBe('Second');
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/engine/reader-engine.test.ts --reporter=verbose`
Expected: FAIL — paragraph break tests fail because the engine doesn't handle them.

- [ ] **Step 3: Update the reader engine**

Replace the contents of `src/lib/engine/reader-engine.svelte.ts` with:

```typescript
import type { Token, ReaderStatus } from '$lib/types';
import { calculateDelay } from './timing';
import { isSentenceEnd } from './punctuation';

export function createReaderEngine() {
	let tokens = $state<Token[]>([]);
	let currentIndex = $state(0);
	let status = $state<ReaderStatus>('stopped');
	let wpm = $state(300);
	let variableSpeed = $state(true);
	let pauseAtPunctuation = $state(true);
	let timerId: ReturnType<typeof setTimeout> | null = null;

	function scheduleNext() {
		if (status !== 'playing') return;
		if (currentIndex >= tokens.length) {
			stop();
			return;
		}

		const token = tokens[currentIndex];

		if (token.isParagraphBreak) {
			const delay = calculateDelay('', wpm, false, false, true);
			timerId = setTimeout(() => {
				currentIndex++;
				scheduleNext();
			}, delay);
			return;
		}

		const delay = calculateDelay(token.text, wpm, variableSpeed, pauseAtPunctuation);

		timerId = setTimeout(() => {
			currentIndex++;
			scheduleNext();
		}, delay);
	}

	function play() {
		if (tokens.length === 0) return;
		if (status === 'playing') return;
		status = 'playing';
		scheduleNext();
	}

	function pause() {
		if (timerId) clearTimeout(timerId);
		timerId = null;
		status = 'paused';
	}

	function stop() {
		if (timerId) clearTimeout(timerId);
		timerId = null;
		status = 'stopped';
		currentIndex = 0;
	}

	function loadTokens(newTokens: Token[]) {
		if (timerId) clearTimeout(timerId);
		timerId = null;
		tokens = newTokens;
		currentIndex = 0;
		status = 'stopped';
	}

	function seekTo(progress: number) {
		let idx = Math.round(progress * tokens.length);
		if (idx >= tokens.length) idx = tokens.length - 1;
		if (idx < 0) idx = 0;
		currentIndex = idx;
	}

	function skipParagraphs(idx: number, direction: 1 | -1): number {
		while (idx >= 0 && idx < tokens.length && tokens[idx].isParagraphBreak) {
			idx += direction;
		}
		if (idx < 0) return 0;
		if (idx >= tokens.length) return tokens.length - 1;
		return idx;
	}

	function skipForward(n: number) {
		let idx = Math.min(currentIndex + n, tokens.length - 1);
		currentIndex = skipParagraphs(idx, 1);
	}

	function skipBack(n: number) {
		let idx = Math.max(currentIndex - n, 0);
		currentIndex = skipParagraphs(idx, -1);
	}

	function nextSentence() {
		for (let i = currentIndex; i < tokens.length; i++) {
			if (tokens[i].isParagraphBreak) continue;
			if (isSentenceEnd(tokens[i].text)) {
				let next = i + 1;
				next = skipParagraphs(next, 1);
				if (next < tokens.length) {
					currentIndex = next;
				}
				return;
			}
		}
		currentIndex = tokens.length - 1;
	}

	function prevSentence() {
		let i = currentIndex - 1;
		while (i >= 0) {
			if (tokens[i].isParagraphBreak) { i--; continue; }
			if (isSentenceEnd(tokens[i].text)) {
				if (i + 1 < currentIndex) {
					currentIndex = skipParagraphs(i + 1, 1);
					return;
				}
				i--;
				while (i >= 0) {
					if (tokens[i].isParagraphBreak) { i--; continue; }
					if (isSentenceEnd(tokens[i].text)) {
						currentIndex = skipParagraphs(i + 1, 1);
						return;
					}
					i--;
				}
				currentIndex = 0;
				return;
			}
			i--;
		}
		currentIndex = 0;
	}

	function destroy() {
		if (timerId) clearTimeout(timerId);
		timerId = null;
	}

	return {
		get tokens() { return tokens; },
		get currentIndex() { return currentIndex; },
		get status() { return status; },
		get wpm() { return wpm; },
		set wpm(v: number) { wpm = v; },
		get variableSpeed() { return variableSpeed; },
		set variableSpeed(v: boolean) { variableSpeed = v; },
		get pauseAtPunctuation() { return pauseAtPunctuation; },
		set pauseAtPunctuation(v: boolean) { pauseAtPunctuation = v; },
		get currentWord() {
			return tokens.length > 0 && currentIndex < tokens.length
				? tokens[currentIndex].text
				: '';
		},
		get currentToken() {
			return tokens.length > 0 && currentIndex < tokens.length
				? tokens[currentIndex]
				: null;
		},
		get progress() {
			return tokens.length === 0 ? 0 : currentIndex / tokens.length;
		},
		play,
		pause,
		stop,
		loadTokens,
		seekTo,
		skipForward,
		skipBack,
		nextSentence,
		prevSentence,
		destroy
	};
}

export type ReaderEngine = ReturnType<typeof createReaderEngine>;
```

- [ ] **Step 4: Run reader engine tests**

Run: `npx vitest run tests/lib/engine/reader-engine.test.ts --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/reader-engine.svelte.ts tests/lib/engine/reader-engine.test.ts
git commit -m "feat: handle paragraph break tokens in reader engine

- scheduleNext pauses at paragraph tokens without changing displayed word
- skipForward/skipBack skip over paragraph break tokens
- nextSentence/prevSentence ignore paragraph break tokens during scan"
```

---

### Task 6: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass — both new and existing.

- [ ] **Step 2: Run type checker**

Run: `cd /home/ratan/personal/rsvp-reader-v2 && npx svelte-check --tsconfig ./tsconfig.json`
Expected: No type errors.

- [ ] **Step 3: Run build**

Run: `cd /home/ratan/personal/rsvp-reader-v2 && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual spot-check of key behaviors**

Verify these specific scenarios work by reading the code or tracing logic:

1. `calculateDelay('Dr.', 300, false, true)` → 200ms (abbreviation, no sentence pause)
2. `calculateDelay('$3.99', 300, false, true)` → 300ms (numeric, 1.5x)
3. `calculateDelay('end.', 300, false, true)` → 500ms (sentence end, 2.5x)
4. `calculateDelay('I', 300, true, false)` → 180ms (short word, 0.9x tier)
5. `calculateDelay('extraordinary', 300, true, false)` → 260ms (long word, 1.3x tier)
6. `calculateDelay('', 300, false, false, true)` → 360ms (paragraph break, 1.8x)
7. `parseText('commander-in-chief')` → 3 tokens
8. `parseText('well-known')` → 1 token
9. `parseText('hello\n\nworld')` → 3 tokens (with paragraph break)

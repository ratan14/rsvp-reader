# RSVP Reader v2: Research-Aligned Update

**Date:** 2026-04-05
**Status:** Draft
**Approach:** B (Research-Aligned Overhaul)

## Motivation

The RSVP reader v2 works but its timing model uses a simple linear formula and has edge cases where punctuation detection fails (abbreviations). Academic research on RSVP reading and analysis of established open-source implementations suggest specific, evidence-backed improvements to timing, tokenization, and punctuation handling.

Research sources:
- `research/2026-04-05-optimal-focal-letter-position-rsvp.md`
- `research/2026-04-05-rsvp-word-splitting-timing-recommendations.md`

## Scope

Changes are limited to the engine layer (`src/lib/engine/`) and types. No changes to UI components, importers, library, preferences, or theme.

---

## 1. Punctuation Fixes

### 1a. Abbreviation Detection

**File:** `src/lib/engine/punctuation.ts`

Add `isLikelyAbbreviation(word: string): boolean` that detects:

- **Single-letter-dot repeats:** Tokens matching the pattern of single letters separated by dots. Examples: `U.S.A.`, `e.g.`, `i.e.`, `a.m.`, `p.m.`
- **Common title/suffix abbreviations:** A hardcoded set: `Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Jr.`, `Sr.`, `St.`, `vs.`, `etc.`, `approx.`, `Prof.`, `Gen.`, `Gov.`, `Corp.`, `Inc.`, `Ltd.`, `Vol.`, `No.`, `Fig.`

Detection strips trailing wrapper characters (quotes, brackets) before checking. This requires a helper that returns the stripped core word (not just the trailing char like `trailingPunctuation` does) -- walk inward from both ends past wrapper characters, then check the core string against the patterns.

**Impact on `isSentenceEnd`:** Returns `false` when `isLikelyAbbreviation` matches, even if trailing char is `.`.

**Known trade-off:** An abbreviation like `"etc."` at the actual end of a sentence will not get a sentence-end pause. This is acceptable -- the alternative (trying to detect "real" sentence ends after abbreviations) requires sentence-level context the tokenizer doesn't have. The clause and paragraph pauses provide sufficient breathing room.

### 1b. Numeric Detection

**File:** `src/lib/engine/punctuation.ts`

Add `isNumeric(word: string): boolean` that returns `true` when a token is primarily numeric. Matches tokens where, after stripping leading/trailing punctuation and currency symbols, the remaining content is digits optionally containing `.`, `,`, `/`, `-`, `:` separators.

Examples that match: `42`, `$3.99`, `2026`, `3,000`, `50%`, `12:30`, `1/2`, `(42)`, `"100"`
Examples that don't match: `hello`, `h2o`, `4th`, `COVID-19`

The heuristic: strip wrappers and currency symbols (`$`, `€`, `£`, `¥`), then check if the remaining string matches `/^\d[\d.,/:%-]*$/`.

---

## 2. Parser Changes

### 2a. Paragraph Boundary Detection

**File:** `src/lib/engine/parser.ts`

Before normalizing whitespace, scan raw text for paragraph boundaries using the pattern `\n\s*\n` (one or more blank lines). At each boundary, record the character position.

After tokenization, insert a paragraph-break marker token at the appropriate position in the token array. The marker has:

```typescript
{ text: '', index: N, orp: 0, isParagraphBreak: true }
```

Paragraph markers are inserted between the last token before the break and the first token after. Chapter index assignment applies to paragraph markers based on their position.

Consecutive paragraph breaks (3+ blank lines) produce a single marker, not multiple.

### 2b. Hybrid Hyphen Splitting

**File:** `src/lib/engine/parser.ts`

After extracting a whitespace-delimited token, if it contains one or more hyphens (`-`) and its total length exceeds 13 characters, split it at hyphens into separate tokens. Each sub-token gets its own ORP calculated independently.

- `"well-known"` (10 chars) -> 1 token: `"well-known"`
- `"mother-in-law"` (13 chars) -> 1 token: `"mother-in-law"` (at threshold, not over)
- `"commander-in-chief"` (18 chars) -> 3 tokens: `"commander"`, `"in"`, `"chief"`

The threshold of 13 aligns with the ORP lookup table's last specific entry before the 14+ catchall.

Empty segments from splitting (e.g., double hyphens) are discarded.

---

## 3. Timing Overhaul

### 3a. Variable Speed Tiers

**File:** `src/lib/engine/timing.ts`

Replace the current linear formula (`word.length / 5.0`, clamped 0.8-2.0) with discrete research-backed tiers:

| Word Length | Multiplier | Source |
|-------------|-----------|--------|
| 1-2 chars | 0.9x | Emacs RSVP (0.8x), adjusted up because research notes short words can be harder |
| 3-8 chars | 1.0x | Baseline -- no adjustment |
| 9+ chars | 1.3x | Emacs RSVP, SpeedReader |

The tier is determined by `word.length` (full token including punctuation), consistent with current behavior where the length includes attached punctuation.

### 3b. Sentence-End Pause

**File:** `src/lib/engine/timing.ts`

Change sentence-end multiplier from `2.0x` to `2.5x`.

Rationale: Current 2.0x is at the low end of the research range (1.5x-3.0x). The 2.5x value is the median. Academic research identifies sentence pauses as the single most impactful feature for RSVP comprehension.

### 3c. Numeric Token Delay

**File:** `src/lib/engine/timing.ts`

When `isNumeric(word)` returns `true`, apply a `1.5x` multiplier. Numbers require more cognitive processing than words.

Stacking: Numeric delay stacks with variable speed tier but not with punctuation pauses. If a numeric token also triggers a sentence or clause pause, only the punctuation pause applies (it's larger). This prevents double-penalizing tokens like `"$3.99."`.

### 3d. Paragraph Break Delay

**File:** `src/lib/engine/timing.ts`

The `calculateDelay` function accepts an optional `isParagraphBreak` flag. When `true`, return `base delay * 1.8x` regardless of other settings. Paragraph breaks are structural pauses, not word-dependent.

Updated signature:

```typescript
calculateDelay(
  word: string,
  wpm: number,
  variableSpeed: boolean,
  pauseAtPunctuation: boolean,
  isParagraphBreak?: boolean
): number
```

### 3e. Stacking Order

```
if isParagraphBreak:
  return round(baseDelay * 1.8)

factor = 1.0
if variableSpeed:
  factor *= tierMultiplier(word.length)  // 0.9, 1.0, or 1.3

if pauseAtPunctuation:
  if isSentenceEnd(word):
    factor *= 2.5
  elif isClauseEnd(word):
    factor *= 1.5
  elif isNumeric(word):
    factor *= 1.5

return round(baseDelay * factor)
```

Numeric delay is in the `elif` chain under the `pauseAtPunctuation` guard -- it only fires when `pauseAtPunctuation` is enabled, and only when the token doesn't already have a sentence or clause pause. This is intentional: numeric delay is a punctuation-category timing feature.

---

## 4. Type Changes

**File:** `src/lib/types.ts`

Add one optional field to the `Token` interface:

```typescript
export interface Token {
  text: string;
  index: number;
  chapterIndex?: number;
  orp: number;
  isParagraphBreak?: boolean;
}
```

No other type changes. `UserPreferences` is unchanged -- no new user-facing settings.

---

## 5. Reader Engine Changes

**File:** `src/lib/engine/reader-engine.svelte.ts`

### 5a. Paragraph Break in Playback

In `scheduleNext()`, when the current token has `isParagraphBreak: true`:
1. Calculate delay using `calculateDelay('', wpm, false, false, true)`
2. Do **not** update the displayed word -- the previous word stays visible
3. After the delay, advance `currentIndex` and call `scheduleNext()` again

This produces a natural pause without a blank flash.

### 5b. Skip Over Paragraph Tokens

`skipForward(n)` and `skipBack(n)`: After moving by `n`, if the new position lands on a paragraph break token, continue in the same direction until landing on a real token.

`nextSentence()` and `prevSentence()`: Skip paragraph break tokens during the scan (they aren't sentence boundaries).

---

## 6. Test Plan

All changes are in the engine layer with pure functions, making them straightforward to unit test.

### `punctuation.test.ts` (new cases):
- `isLikelyAbbreviation`: single-letter-dot patterns (`U.S.A.`, `e.g.`, `i.e.`), common titles (`Dr.`, `Mr.`), non-abbreviations (`hello.`, `end.`), abbreviations through quotes (`"Dr."`)
- `isNumeric`: integers, decimals, currency (`$3.99`), percentages (`50%`), times (`12:30`), fractions (`1/2`), non-numeric (`hello`, `h2o`, `4th`)
- `isSentenceEnd`: returns `false` for abbreviations, still `true` for real sentence ends

### `parser.test.ts` (new cases):
- Paragraph detection: text with `\n\n` produces marker tokens at correct positions
- Consecutive blank lines produce single marker
- No markers for single newlines
- Hyphen splitting: tokens <= 13 chars stay intact, tokens > 13 chars split at hyphens
- Empty segments from double-hyphens discarded
- Split sub-tokens get correct ORP values

### `timing.test.ts` (updated + new cases):
- Tier multipliers: 1-2 char words get 0.9x, 3-8 get 1.0x, 9+ get 1.3x (replaces old linear tests)
- Sentence-end pause now 2.5x (update existing assertions)
- Numeric delay: 1.5x for numeric tokens
- Numeric + sentence-end: only sentence-end applies (no double stack)
- Paragraph break: returns base * 1.8x regardless of other flags

### `reader-engine.test.ts` (new cases):
- Playback skips paragraph tokens without changing displayed word
- `skipForward`/`skipBack` don't land on paragraph tokens
- `nextSentence`/`prevSentence` skip paragraph tokens

---

## Files Modified

| File | Change Type |
|------|------------|
| `src/lib/types.ts` | Add `isParagraphBreak` to Token |
| `src/lib/engine/punctuation.ts` | Add `isLikelyAbbreviation`, `isNumeric`; update `isSentenceEnd` |
| `src/lib/engine/parser.ts` | Add paragraph detection, hybrid hyphen splitting |
| `src/lib/engine/timing.ts` | Replace linear formula with tiers, update multipliers, add paragraph/numeric delays |
| `src/lib/engine/reader-engine.svelte.ts` | Handle paragraph tokens in playback and navigation |
| `tests/lib/engine/punctuation.test.ts` | New cases for abbreviations, numerics |
| `tests/lib/engine/parser.test.ts` | New cases for paragraphs, hyphens |
| `tests/lib/engine/timing.test.ts` | Update existing, add tier/paragraph/numeric cases |
| `tests/lib/engine/reader-engine.test.ts` | New cases for paragraph token handling |

## Files Not Modified

- UI components (`+page.svelte`, `+layout.svelte`)
- Importers (`text-importer.ts`, `paste-importer.ts`, `epub-importer.ts`, `url-importer.ts`)
- Storage (`library.svelte.ts`, `preferences.svelte.ts`)
- ORP (`orp.ts`) -- already research-aligned
- Theme, config files, static assets

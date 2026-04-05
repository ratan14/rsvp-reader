# RSVP Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based RSVP speed reader that supports file upload (.txt/.epub), paste, and URL import with local persistence, variable-speed playback, ORP highlighting, themes, and keyboard/scroll controls.

**Architecture:** SvelteKit SPA with adapter-static for deployment to any static host. Core RSVP engine is a standalone TypeScript module using Svelte 5 runes (`.svelte.ts`) for reactivity. Content importers each produce a shared `ContentResult` interface. All persistence is localStorage-based. Theming uses CSS custom properties toggled via a `data-theme` attribute.

**Tech Stack:** SvelteKit, TypeScript, Tailwind CSS, Svelte 5 runes, vitest, jszip (EPUB), @mozilla/readability (URL extraction)

**Spec:** `docs/superpowers/specs/2026-04-05-rsvp-reader-design.md`

---

## File Structure

```
src/
  lib/
    types.ts                     — All shared TypeScript interfaces (Token, ContentResult, LibraryEntry, UserPreferences)
    engine/
      orp.ts                     — ORP index calculation (pure function)
      timing.ts                  — Variable delay calculation (pure function)
      parser.ts                  — Text → Token[] parsing pipeline
      reader-engine.svelte.ts    — Playback state machine with timer, Svelte 5 runes
    importers/
      text-importer.ts           — .txt file → ContentResult
      paste-importer.ts          — Pasted string → ContentResult
      epub-importer.ts           — .epub file → ContentResult (jszip + XML parsing)
      url-importer.ts            — URL → ContentResult (fetch + Readability.js)
    storage/
      preferences.svelte.ts     — UserPreferences store (localStorage + $state)
      library.svelte.ts         — LibraryEntry[] store (localStorage + $state)
    theme/
      theme.svelte.ts           — Theme store and toggle logic
  routes/
    +layout.svelte              — Root layout: nav bar (hidden on /read), theme init
    +layout.ts                  — SPA config: export ssr = false
    +page.svelte                — Home page: file upload, paste, URL input
    library/
      +page.svelte              — Library page: list entries, resume reading
    read/
      +page.svelte              — Reader page: word display, ORP, controls, keyboard/scroll
  app.css                       — Tailwind imports + CSS custom properties for themes
  app.html                      — HTML shell template
tests/
  lib/
    engine/
      orp.test.ts
      timing.test.ts
      parser.test.ts
      reader-engine.test.ts
    importers/
      text-importer.test.ts
      paste-importer.test.ts
      epub-importer.test.ts
      url-importer.test.ts
    storage/
      preferences.test.ts
      library.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`, `src/routes/+layout.ts`, `src/routes/+page.svelte`

- [ ] **Step 1: Scaffold SvelteKit project**

Run from the project root (`/home/ratan/personal/rsvp-reader-v2`):

```bash
cd /tmp && npx sv create rsvp-scaffold --template minimal --types ts --no-install
```

Copy scaffolded files into the project (preserving existing `docs/` and `.git/`):

```bash
cp -r /tmp/rsvp-scaffold/* /home/ratan/personal/rsvp-reader-v2/
cp /tmp/rsvp-scaffold/.gitignore /home/ratan/personal/rsvp-reader-v2/
cp /tmp/rsvp-scaffold/.npmrc /home/ratan/personal/rsvp-reader-v2/ 2>/dev/null || true
rm -rf /tmp/rsvp-scaffold
```

- [ ] **Step 2: Install dependencies**

```bash
cd /home/ratan/personal/rsvp-reader-v2
npm install
```

- [ ] **Step 3: Install project-specific dependencies**

```bash
npm install @sveltejs/adapter-static
npm install jszip @mozilla/readability
npm install -D @types/jszip tailwindcss @tailwindcss/vite
```

- [ ] **Step 4: Configure adapter-static for SPA mode**

Replace `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		})
	}
};

export default config;
```

- [ ] **Step 5: Configure Tailwind in vite.config.ts**

```ts
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
});
```

- [ ] **Step 6: Set up app.css with Tailwind and theme variables**

Replace `src/app.css`:

```css
@import 'tailwindcss';

:root,
[data-theme='dark'] {
	--bg: #1a1a2e;
	--bg-surface: #252540;
	--text: #e0e0e0;
	--text-muted: #888888;
	--accent: #ff6b6b;
	--border: #333333;
}

[data-theme='light'] {
	--bg: #f5f5f0;
	--bg-surface: #ffffff;
	--text: #333333;
	--text-muted: #999999;
	--accent: #e74c3c;
	--border: #dddddd;
}

body {
	background-color: var(--bg);
	color: var(--text);
	font-family: system-ui, -apple-system, sans-serif;
	margin: 0;
}
```

- [ ] **Step 7: Disable SSR for SPA mode**

Create `src/routes/+layout.ts`:

```ts
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 8: Create placeholder home page**

Replace `src/routes/+page.svelte`:

```svelte
<h1 class="text-2xl font-bold p-8" style="color: var(--text)">RSVP Reader</h1>
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run dev -- --port 5173 &
sleep 3 && curl -s http://localhost:5173 | head -20
kill %1 2>/dev/null
```

Expected: HTML output containing "RSVP Reader". If `sv create` CLI flags differ from expected, adjust — the goal is a working SvelteKit skeleton with TypeScript.

- [ ] **Step 10: Verify tests run**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run 2>&1 | tail -5
```

Expected: vitest runs successfully (may show "no test files" — that's fine at this stage).

- [ ] **Step 11: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add -A
git commit -m "feat: scaffold SvelteKit project with TypeScript, Tailwind, adapter-static"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Define all shared interfaces**

Create `src/lib/types.ts`:

```ts
export interface Token {
	text: string;
	index: number;
	chapterIndex?: number;
	orp: number;
}

export interface Chapter {
	title: string;
	charOffset: number;
}

export interface ContentResult {
	title: string;
	text: string;
	chapters?: Chapter[];
	source: 'file' | 'paste' | 'url';
}

export interface LibraryChapter {
	title: string;
	wordOffset: number;
}

export interface LibraryEntry {
	id: string;
	title: string;
	source: 'file' | 'paste' | 'url';
	sourceRef: string;
	currentIndex: number;
	totalWords: number;
	chapters?: LibraryChapter[];
	lastRead: number;
	wpm: number;
	cachedText: string;
}

export interface UserPreferences {
	defaultWpm: number;
	theme: 'dark' | 'light';
	variableSpeed: boolean;
	pauseAtPunctuation: boolean;
	wpmStepSize: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
	defaultWpm: 300,
	theme: 'dark',
	variableSpeed: true,
	pauseAtPunctuation: true,
	wpmStepSize: 5
};

export type ReaderStatus = 'stopped' | 'playing' | 'paused';
```

- [ ] **Step 2: Verify types compile**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx tsc --noEmit src/lib/types.ts 2>&1
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript interfaces"
```

---

### Task 3: ORP Calculation & Variable Timing

**Files:**
- Create: `src/lib/engine/orp.ts`, `src/lib/engine/timing.ts`, `tests/lib/engine/orp.test.ts`, `tests/lib/engine/timing.test.ts`

- [ ] **Step 1: Write failing ORP tests**

Create `tests/lib/engine/orp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateOrp } from '$lib/engine/orp';

describe('calculateOrp', () => {
	it('returns 0 for single-character words', () => {
		expect(calculateOrp('a')).toBe(0);
	});

	it('returns 0 for two-character words', () => {
		expect(calculateOrp('to')).toBe(0);
	});

	it('returns 1 for three-character words', () => {
		expect(calculateOrp('the')).toBe(1);
	});

	it('returns approximately 1/3 position for longer words', () => {
		// "discovery" = 9 chars, 1/3 = 3, so index 2 (0-based, rounded down from 9*0.33)
		expect(calculateOrp('discovery')).toBe(2);
	});

	it('returns 1 for four-character words', () => {
		expect(calculateOrp('word')).toBe(1);
	});

	it('handles very long words', () => {
		const word = 'extraordinary'; // 13 chars
		const orp = calculateOrp(word);
		expect(orp).toBe(4); // floor(13 * 0.33)
	});

	it('returns 0 for empty string', () => {
		expect(calculateOrp('')).toBe(0);
	});
});
```

- [ ] **Step 2: Run ORP tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/orp.test.ts 2>&1
```

Expected: FAIL — module `$lib/engine/orp` not found.

- [ ] **Step 3: Implement ORP calculation**

Create `src/lib/engine/orp.ts`:

```ts
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
```

- [ ] **Step 4: Run ORP tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/orp.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 5: Write failing timing tests**

Create `tests/lib/engine/timing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateDelay } from '$lib/engine/timing';

describe('calculateDelay', () => {
	const baseWpm = 300;
	const baseDelay = 60000 / baseWpm; // 200ms

	it('returns base delay for a 5-letter word with no adjustments', () => {
		const delay = calculateDelay('hello', baseWpm, false, false);
		expect(delay).toBe(200);
	});

	it('increases delay for long words when variableSpeed is on', () => {
		const delay = calculateDelay('extraordinary', baseWpm, true, false);
		// factor = 13/5 = 2.6, clamped to 2.0 → 200 * 2.0 = 400
		expect(delay).toBe(400);
	});

	it('decreases delay for short words when variableSpeed is on', () => {
		const delay = calculateDelay('at', baseWpm, true, false);
		// factor = 2/5 = 0.4, clamped to 0.8 → 200 * 0.8 = 160
		expect(delay).toBe(160);
	});

	it('clamps factor to minimum 0.8', () => {
		const delay = calculateDelay('I', baseWpm, true, false);
		// factor = 1/5 = 0.2, clamped to 0.8 → 200 * 0.8 = 160
		expect(delay).toBe(160);
	});

	it('clamps factor to maximum 2.0', () => {
		const delay = calculateDelay('abcdefghijklmnop', baseWpm, true, false);
		// factor = 16/5 = 3.2, clamped to 2.0
		expect(delay).toBe(400);
	});

	it('doubles delay for sentence-ending punctuation', () => {
		const delay = calculateDelay('end.', baseWpm, false, true);
		expect(delay).toBe(400);
	});

	it('doubles delay for question marks', () => {
		const delay = calculateDelay('why?', baseWpm, false, true);
		expect(delay).toBe(400);
	});

	it('doubles delay for exclamation marks', () => {
		const delay = calculateDelay('wow!', baseWpm, false, true);
		expect(delay).toBe(400);
	});

	it('applies 1.5x delay for clause-ending punctuation', () => {
		const delay = calculateDelay('however,', baseWpm, false, true);
		expect(delay).toBe(300);
	});

	it('applies 1.5x for semicolons', () => {
		const delay = calculateDelay('first;', baseWpm, false, true);
		expect(delay).toBe(300);
	});

	it('applies 1.5x for colons', () => {
		const delay = calculateDelay('note:', baseWpm, false, true);
		expect(delay).toBe(300);
	});

	it('applies both variable speed and punctuation', () => {
		// "end." = 4 chars, factor = 4/5 = 0.8 → 200 * 0.8 = 160, then *2 = 320
		const delay = calculateDelay('end.', baseWpm, true, true);
		expect(delay).toBe(320);
	});

	it('ignores punctuation when pauseAtPunctuation is false', () => {
		const delay = calculateDelay('end.', baseWpm, false, false);
		expect(delay).toBe(200);
	});

	it('handles different WPM values', () => {
		const delay = calculateDelay('hello', 600, false, false);
		expect(delay).toBe(100); // 60000 / 600 = 100
	});
});
```

- [ ] **Step 6: Run timing tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/timing.test.ts 2>&1
```

Expected: FAIL — module `$lib/engine/timing` not found.

- [ ] **Step 7: Implement timing calculation**

Create `src/lib/engine/timing.ts`:

```ts
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
```

- [ ] **Step 8: Run timing tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/timing.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/engine/orp.ts src/lib/engine/timing.ts tests/lib/engine/orp.test.ts tests/lib/engine/timing.test.ts
git commit -m "feat: add ORP calculation and variable timing (TDD)"
```

---

### Task 4: Text Parser

**Files:**
- Create: `src/lib/engine/parser.ts`, `tests/lib/engine/parser.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `tests/lib/engine/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseText } from '$lib/engine/parser';
import type { Chapter } from '$lib/types';

describe('parseText', () => {
	it('splits simple text into tokens', () => {
		const tokens = parseText('hello world');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].text).toBe('hello');
		expect(tokens[0].index).toBe(0);
		expect(tokens[1].text).toBe('world');
		expect(tokens[1].index).toBe(1);
	});

	it('computes ORP for each token', () => {
		const tokens = parseText('discovery');
		expect(tokens[0].orp).toBe(2); // ~1/3 of 9
	});

	it('handles multiple whitespace and newlines', () => {
		const tokens = parseText('hello   world\n\nfoo   bar');
		expect(tokens).toHaveLength(4);
		expect(tokens.map((t) => t.text)).toEqual(['hello', 'world', 'foo', 'bar']);
	});

	it('skips empty tokens', () => {
		const tokens = parseText('  hello  ');
		expect(tokens).toHaveLength(1);
		expect(tokens[0].text).toBe('hello');
	});

	it('returns empty array for empty string', () => {
		expect(parseText('')).toEqual([]);
	});

	it('returns empty array for whitespace-only string', () => {
		expect(parseText('   \n\n  ')).toEqual([]);
	});

	it('assigns chapter indices when chapters are provided', () => {
		const text = 'aaa bbb ccc ddd eee fff';
		// "aaa bbb ccc " = 12 chars → chapter 2 starts at charOffset 12
		const chapters: Chapter[] = [
			{ title: 'Chapter 1', charOffset: 0 },
			{ title: 'Chapter 2', charOffset: 12 }
		];
		const tokens = parseText(text, chapters);
		expect(tokens[0].chapterIndex).toBe(0); // "aaa" at char 0
		expect(tokens[1].chapterIndex).toBe(0); // "bbb" at char 4
		expect(tokens[2].chapterIndex).toBe(0); // "ccc" at char 8
		expect(tokens[3].chapterIndex).toBe(1); // "ddd" at char 12
		expect(tokens[4].chapterIndex).toBe(1); // "eee" at char 16
		expect(tokens[5].chapterIndex).toBe(1); // "fff" at char 20
	});

	it('handles no chapters (all chapterIndex undefined)', () => {
		const tokens = parseText('hello world');
		expect(tokens[0].chapterIndex).toBeUndefined();
		expect(tokens[1].chapterIndex).toBeUndefined();
	});

	it('preserves punctuation attached to words', () => {
		const tokens = parseText('Hello, world!');
		expect(tokens[0].text).toBe('Hello,');
		expect(tokens[1].text).toBe('world!');
	});
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/parser.test.ts 2>&1
```

Expected: FAIL — module `$lib/engine/parser` not found.

- [ ] **Step 3: Implement parser**

Create `src/lib/engine/parser.ts`:

```ts
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

	// Split by whitespace, tracking position
	const regex = /\S+/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		const word = match[0];
		const wordCharPos = match.index;

		let chapterIndex: number | undefined;
		if (chapters && chapters.length > 0) {
			// Find which chapter this word belongs to (last chapter whose offset <= wordCharPos)
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
```

- [ ] **Step 4: Run parser tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/parser.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/engine/parser.ts tests/lib/engine/parser.test.ts
git commit -m "feat: add text-to-token parser with chapter mapping (TDD)"
```

---

### Task 5: Reader Engine

**Files:**
- Create: `src/lib/engine/reader-engine.svelte.ts`, `tests/lib/engine/reader-engine.test.ts`

- [ ] **Step 1: Write failing reader engine tests**

Create `tests/lib/engine/reader-engine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReaderEngine } from '$lib/engine/reader-engine.svelte';
import type { Token } from '$lib/types';

function makeTokens(words: string[]): Token[] {
	return words.map((text, index) => ({ text, index, orp: 0 }));
}

describe('createReaderEngine', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllTimers();
	});

	it('starts in stopped state with no words', () => {
		const engine = createReaderEngine();
		expect(engine.status).toBe('stopped');
		expect(engine.currentIndex).toBe(0);
		expect(engine.tokens).toEqual([]);
	});

	it('loads tokens and resets index', () => {
		const engine = createReaderEngine();
		const tokens = makeTokens(['hello', 'world']);
		engine.loadTokens(tokens);
		expect(engine.tokens).toEqual(tokens);
		expect(engine.currentIndex).toBe(0);
		expect(engine.status).toBe('stopped');
	});

	it('returns current word from tokens', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['hello', 'world']));
		expect(engine.currentWord).toBe('hello');
	});

	it('returns empty string for currentWord when no tokens', () => {
		const engine = createReaderEngine();
		expect(engine.currentWord).toBe('');
	});

	it('calculates progress', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c', 'd']));
		expect(engine.progress).toBe(0);
	});

	it('play starts advancing words', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c']));
		engine.wpm = 300;
		engine.variableSpeed = false;
		engine.pauseAtPunctuation = false;
		engine.play();
		expect(engine.status).toBe('playing');

		// At 300 WPM, base delay = 200ms
		vi.advanceTimersByTime(200);
		expect(engine.currentIndex).toBe(1);

		vi.advanceTimersByTime(200);
		expect(engine.currentIndex).toBe(2);
	});

	it('pause stops advancing', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c']));
		engine.wpm = 300;
		engine.variableSpeed = false;
		engine.pauseAtPunctuation = false;
		engine.play();
		vi.advanceTimersByTime(200);
		expect(engine.currentIndex).toBe(1);

		engine.pause();
		expect(engine.status).toBe('paused');
		vi.advanceTimersByTime(1000);
		expect(engine.currentIndex).toBe(1); // didn't advance
	});

	it('stop resets to beginning', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c']));
		engine.wpm = 300;
		engine.variableSpeed = false;
		engine.pauseAtPunctuation = false;
		engine.play();
		vi.advanceTimersByTime(200);
		engine.stop();
		expect(engine.status).toBe('stopped');
		expect(engine.currentIndex).toBe(0);
	});

	it('stops automatically at end of tokens', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b']));
		engine.wpm = 300;
		engine.variableSpeed = false;
		engine.pauseAtPunctuation = false;
		engine.play();
		vi.advanceTimersByTime(200); // index 1
		vi.advanceTimersByTime(200); // past end → stop
		expect(engine.status).toBe('stopped');
	});

	it('seekTo sets index', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c', 'd']));
		engine.seekTo(0.5);
		expect(engine.currentIndex).toBe(2);
	});

	it('skipForward advances by N words', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']));
		engine.skipForward(5);
		expect(engine.currentIndex).toBe(5);
	});

	it('skipBack goes back by N words', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']));
		engine.seekTo(0.8); // index 8
		engine.skipBack(5);
		expect(engine.currentIndex).toBe(3);
	});

	it('skipBack does not go below 0', () => {
		const engine = createReaderEngine();
		engine.loadTokens(makeTokens(['a', 'b', 'c']));
		engine.skipBack(10);
		expect(engine.currentIndex).toBe(0);
	});

	it('does not play when tokens are empty', () => {
		const engine = createReaderEngine();
		engine.play();
		expect(engine.status).toBe('stopped');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/reader-engine.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement reader engine**

Create `src/lib/engine/reader-engine.svelte.ts`:

```ts
import type { Token, ReaderStatus } from '$lib/types';
import { calculateDelay } from './timing';

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

		const word = tokens[currentIndex].text;
		const delay = calculateDelay(word, wpm, variableSpeed, pauseAtPunctuation);

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

	function skipForward(n: number) {
		currentIndex = Math.min(currentIndex + n, tokens.length - 1);
	}

	function skipBack(n: number) {
		currentIndex = Math.max(currentIndex - n, 0);
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
		destroy
	};
}

export type ReaderEngine = ReturnType<typeof createReaderEngine>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/engine/reader-engine.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/engine/reader-engine.svelte.ts tests/lib/engine/reader-engine.test.ts
git commit -m "feat: add RSVP reader engine with playback state machine (TDD)"
```

---

### Task 6: Storage Layer (Preferences & Library)

**Files:**
- Create: `src/lib/storage/preferences.svelte.ts`, `src/lib/storage/library.svelte.ts`, `tests/lib/storage/preferences.test.ts`, `tests/lib/storage/library.test.ts`

- [ ] **Step 1: Write failing preferences tests**

Create `tests/lib/storage/preferences.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPreferencesStore } from '$lib/storage/preferences.svelte';
import { DEFAULT_PREFERENCES } from '$lib/types';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('PreferencesStore', () => {
	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('returns defaults when nothing is stored', () => {
		const prefs = createPreferencesStore();
		expect(prefs.preferences).toEqual(DEFAULT_PREFERENCES);
	});

	it('loads saved preferences from localStorage', () => {
		const saved = { ...DEFAULT_PREFERENCES, defaultWpm: 500, theme: 'light' as const };
		localStorageMock.setItem('rsvp-preferences', JSON.stringify(saved));
		const prefs = createPreferencesStore();
		expect(prefs.preferences.defaultWpm).toBe(500);
		expect(prefs.preferences.theme).toBe('light');
	});

	it('updates a preference and persists to localStorage', () => {
		const prefs = createPreferencesStore();
		prefs.update({ defaultWpm: 450 });
		expect(prefs.preferences.defaultWpm).toBe(450);
		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'rsvp-preferences',
			expect.stringContaining('"defaultWpm":450')
		);
	});

	it('merges partial updates without losing other fields', () => {
		const prefs = createPreferencesStore();
		prefs.update({ theme: 'light' });
		expect(prefs.preferences.defaultWpm).toBe(DEFAULT_PREFERENCES.defaultWpm);
		expect(prefs.preferences.theme).toBe('light');
	});

	it('handles corrupt localStorage data gracefully', () => {
		localStorageMock.setItem('rsvp-preferences', 'not-json');
		const prefs = createPreferencesStore();
		expect(prefs.preferences).toEqual(DEFAULT_PREFERENCES);
	});
});
```

- [ ] **Step 2: Run preferences tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/storage/preferences.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement preferences store**

Create `src/lib/storage/preferences.svelte.ts`:

```ts
import { DEFAULT_PREFERENCES, type UserPreferences } from '$lib/types';

const STORAGE_KEY = 'rsvp-preferences';

function loadFromStorage(): UserPreferences {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_PREFERENCES };
		const parsed = JSON.parse(raw);
		return { ...DEFAULT_PREFERENCES, ...parsed };
	} catch {
		return { ...DEFAULT_PREFERENCES };
	}
}

function saveToStorage(prefs: UserPreferences): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// localStorage full — silently fail
	}
}

export function createPreferencesStore() {
	let preferences = $state<UserPreferences>(loadFromStorage());

	function update(partial: Partial<UserPreferences>) {
		preferences = { ...preferences, ...partial };
		saveToStorage(preferences);
	}

	return {
		get preferences() { return preferences; },
		update
	};
}

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
```

- [ ] **Step 4: Run preferences tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/storage/preferences.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 5: Write failing library tests**

Create `tests/lib/storage/library.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLibraryStore } from '$lib/storage/library.svelte';
import type { LibraryEntry } from '$lib/types';

const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();

vi.stubGlobal('localStorage', localStorageMock);

const makeEntry = (overrides?: Partial<LibraryEntry>): LibraryEntry => ({
	id: 'test-id',
	title: 'Test Book',
	source: 'file',
	sourceRef: 'test.txt',
	currentIndex: 0,
	totalWords: 100,
	lastRead: Date.now(),
	wpm: 300,
	cachedText: 'hello world',
	...overrides
});

describe('LibraryStore', () => {
	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('starts with empty entries when nothing stored', () => {
		const lib = createLibraryStore();
		expect(lib.entries).toEqual([]);
	});

	it('loads entries from localStorage', () => {
		const entry = makeEntry();
		localStorageMock.setItem('rsvp-library', JSON.stringify([entry]));
		const lib = createLibraryStore();
		expect(lib.entries).toHaveLength(1);
		expect(lib.entries[0].title).toBe('Test Book');
	});

	it('saves a new entry', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry());
		expect(lib.entries).toHaveLength(1);
		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'rsvp-library',
			expect.any(String)
		);
	});

	it('updates existing entry by id', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry({ id: 'abc', currentIndex: 0 }));
		lib.save(makeEntry({ id: 'abc', currentIndex: 50 }));
		expect(lib.entries).toHaveLength(1);
		expect(lib.entries[0].currentIndex).toBe(50);
	});

	it('removes an entry by id', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry({ id: 'abc' }));
		lib.save(makeEntry({ id: 'def', title: 'Another' }));
		lib.remove('abc');
		expect(lib.entries).toHaveLength(1);
		expect(lib.entries[0].id).toBe('def');
	});

	it('gets entry by id', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry({ id: 'abc' }));
		expect(lib.getById('abc')?.title).toBe('Test Book');
		expect(lib.getById('nonexistent')).toBeUndefined();
	});

	it('handles corrupt localStorage gracefully', () => {
		localStorageMock.setItem('rsvp-library', 'broken');
		const lib = createLibraryStore();
		expect(lib.entries).toEqual([]);
	});
});
```

- [ ] **Step 6: Run library tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/storage/library.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement library store**

Create `src/lib/storage/library.svelte.ts`:

```ts
import type { LibraryEntry } from '$lib/types';

const STORAGE_KEY = 'rsvp-library';

function loadFromStorage(): LibraryEntry[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveToStorage(entries: LibraryEntry[]): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
		return true;
	} catch {
		return false;
	}
}

export function createLibraryStore() {
	let entries = $state<LibraryEntry[]>(loadFromStorage());

	function save(entry: LibraryEntry): boolean {
		const idx = entries.findIndex((e) => e.id === entry.id);
		if (idx >= 0) {
			entries[idx] = entry;
		} else {
			entries.push(entry);
		}
		return saveToStorage(entries);
	}

	function remove(id: string) {
		entries = entries.filter((e) => e.id !== id);
		saveToStorage(entries);
	}

	function getById(id: string): LibraryEntry | undefined {
		return entries.find((e) => e.id === id);
	}

	return {
		get entries() { return entries; },
		save,
		remove,
		getById
	};
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;
```

- [ ] **Step 8: Run library tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/storage/library.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/storage/ tests/lib/storage/
git commit -m "feat: add preferences and library localStorage stores (TDD)"
```

---

### Task 7: Theme System

**Files:**
- Create: `src/lib/theme/theme.svelte.ts`

- [ ] **Step 1: Implement theme store**

Create `src/lib/theme/theme.svelte.ts`:

```ts
import type { PreferencesStore } from '$lib/storage/preferences.svelte';

export function createThemeStore(preferencesStore: PreferencesStore) {
	function apply() {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', preferencesStore.preferences.theme);
		}
	}

	function toggle() {
		const newTheme = preferencesStore.preferences.theme === 'dark' ? 'light' : 'dark';
		preferencesStore.update({ theme: newTheme });
		apply();
	}

	// Apply on creation
	apply();

	return {
		get current() { return preferencesStore.preferences.theme; },
		toggle,
		apply
	};
}

export type ThemeStore = ReturnType<typeof createThemeStore>;
```

- [ ] **Step 2: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/theme/
git commit -m "feat: add theme store with dark/light toggle"
```

---

### Task 8: Text & Paste Importers

**Files:**
- Create: `src/lib/importers/text-importer.ts`, `src/lib/importers/paste-importer.ts`, `tests/lib/importers/text-importer.test.ts`, `tests/lib/importers/paste-importer.test.ts`

- [ ] **Step 1: Write failing text importer tests**

Create `tests/lib/importers/text-importer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { importTextFile } from '$lib/importers/text-importer';

describe('importTextFile', () => {
	it('returns ContentResult with text and filename as title', () => {
		const result = importTextFile('Hello world, this is a test.', 'my-book.txt');
		expect(result.title).toBe('my-book.txt');
		expect(result.text).toBe('Hello world, this is a test.');
		expect(result.source).toBe('file');
		expect(result.chapters).toBeUndefined();
	});

	it('strips .txt extension from title', () => {
		const result = importTextFile('content', 'readme.txt');
		expect(result.title).toBe('readme');
	});

	it('handles empty content', () => {
		const result = importTextFile('', 'empty.txt');
		expect(result.text).toBe('');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/text-importer.test.ts 2>&1
```

Expected: FAIL.

- [ ] **Step 3: Implement text importer**

Create `src/lib/importers/text-importer.ts`:

```ts
import type { ContentResult } from '$lib/types';

export function importTextFile(text: string, filename: string): ContentResult {
	const title = filename.replace(/\.txt$/i, '');
	return {
		title,
		text,
		source: 'file'
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/text-importer.test.ts 2>&1
```

Expected: All PASS.

- [ ] **Step 5: Write failing paste importer tests**

Create `tests/lib/importers/paste-importer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { importPastedText } from '$lib/importers/paste-importer';

describe('importPastedText', () => {
	it('uses first line as title', () => {
		const result = importPastedText('My Great Story\nOnce upon a time...');
		expect(result.title).toBe('My Great Story');
		expect(result.source).toBe('paste');
		expect(result.chapters).toBeUndefined();
	});

	it('defaults to "Pasted text" when first line is empty', () => {
		const result = importPastedText('\nsome content');
		expect(result.title).toBe('Pasted text');
	});

	it('defaults to "Pasted text" for whitespace-only first line', () => {
		const result = importPastedText('   \ncontent');
		expect(result.title).toBe('Pasted text');
	});

	it('uses "Pasted text" for single-line input (title = content)', () => {
		const result = importPastedText('Hello world');
		expect(result.title).toBe('Hello world');
		expect(result.text).toBe('Hello world');
	});

	it('preserves full text including first line', () => {
		const text = 'Title Line\nBody text here';
		const result = importPastedText(text);
		expect(result.text).toBe(text);
	});
});
```

- [ ] **Step 6: Run paste tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/paste-importer.test.ts 2>&1
```

Expected: FAIL.

- [ ] **Step 7: Implement paste importer**

Create `src/lib/importers/paste-importer.ts`:

```ts
import type { ContentResult } from '$lib/types';

export function importPastedText(text: string): ContentResult {
	const firstLine = text.split('\n')[0].trim();
	const title = firstLine || 'Pasted text';

	return {
		title,
		text,
		source: 'paste'
	};
}
```

- [ ] **Step 8: Run paste tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/paste-importer.test.ts 2>&1
```

Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/importers/text-importer.ts src/lib/importers/paste-importer.ts tests/lib/importers/
git commit -m "feat: add text and paste importers (TDD)"
```

---

### Task 9: EPUB Importer

**Files:**
- Create: `src/lib/importers/epub-importer.ts`, `tests/lib/importers/epub-importer.test.ts`

- [ ] **Step 1: Write failing EPUB importer tests**

Create `tests/lib/importers/epub-importer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { importEpub, extractTextFromHtml } from '$lib/importers/epub-importer';
import JSZip from 'jszip';

describe('extractTextFromHtml', () => {
	it('extracts text content from HTML', () => {
		const html = '<html><body><p>Hello <b>world</b></p><p>Second paragraph</p></body></html>';
		const text = extractTextFromHtml(html);
		expect(text).toContain('Hello world');
		expect(text).toContain('Second paragraph');
	});

	it('returns empty string for empty HTML', () => {
		expect(extractTextFromHtml('')).toBe('');
	});
});

describe('importEpub', () => {
	async function createTestEpub(): Promise<ArrayBuffer> {
		const zip = new JSZip();

		zip.file('mimetype', 'application/epub+zip');

		zip.file(
			'META-INF/container.xml',
			`<?xml version="1.0"?>
			<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
				<rootfiles>
					<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
				</rootfiles>
			</container>`
		);

		zip.file(
			'content.opf',
			`<?xml version="1.0"?>
			<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
				<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
					<dc:title>Test Book</dc:title>
				</metadata>
				<manifest>
					<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
					<item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
					<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
				</manifest>
				<spine toc="toc">
					<itemref idref="ch1"/>
					<itemref idref="ch2"/>
				</spine>
			</package>`
		);

		zip.file(
			'toc.ncx',
			`<?xml version="1.0"?>
			<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
				<navMap>
					<navPoint id="np1">
						<navLabel><text>Chapter One</text></navLabel>
						<content src="ch1.xhtml"/>
					</navPoint>
					<navPoint id="np2">
						<navLabel><text>Chapter Two</text></navLabel>
						<content src="ch2.xhtml"/>
					</navPoint>
				</navMap>
			</ncx>`
		);

		zip.file(
			'ch1.xhtml',
			`<html><body><h1>Chapter One</h1><p>First chapter content here.</p></body></html>`
		);

		zip.file(
			'ch2.xhtml',
			`<html><body><h1>Chapter Two</h1><p>Second chapter content here.</p></body></html>`
		);

		return await zip.generateAsync({ type: 'arraybuffer' });
	}

	it('extracts title from EPUB metadata', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.title).toBe('Test Book');
	});

	it('extracts text from all spine items', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.text).toContain('First chapter content');
		expect(result.text).toContain('Second chapter content');
	});

	it('extracts chapters with char offsets', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.chapters).toBeDefined();
		expect(result.chapters!.length).toBe(2);
		expect(result.chapters![0].title).toBe('Chapter One');
		expect(result.chapters![0].charOffset).toBe(0);
		expect(result.chapters![1].title).toBe('Chapter Two');
		expect(result.chapters![1].charOffset).toBeGreaterThan(0);
	});

	it('sets source to file', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.source).toBe('file');
	});

	it('falls back to filename when no title in metadata', async () => {
		const zip = new JSZip();
		zip.file('mimetype', 'application/epub+zip');
		zip.file(
			'META-INF/container.xml',
			`<?xml version="1.0"?>
			<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
				<rootfiles>
					<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
				</rootfiles>
			</container>`
		);
		zip.file(
			'content.opf',
			`<?xml version="1.0"?>
			<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
				<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"></metadata>
				<manifest>
					<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
				</manifest>
				<spine><itemref idref="ch1"/></spine>
			</package>`
		);
		zip.file('ch1.xhtml', '<html><body><p>Content</p></body></html>');

		const buf = await zip.generateAsync({ type: 'arraybuffer' });
		const result = await importEpub(buf, 'mybook.epub');
		expect(result.title).toBe('mybook');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/epub-importer.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement EPUB importer**

Create `src/lib/importers/epub-importer.ts`:

```ts
import JSZip from 'jszip';
import type { ContentResult, Chapter } from '$lib/types';

/**
 * Extract plain text from HTML/XHTML string.
 * Uses DOMParser in browser; falls back to regex stripping.
 */
export function extractTextFromHtml(html: string): string {
	if (!html) return '';
	if (typeof DOMParser !== 'undefined') {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body?.textContent?.trim() ?? '';
	}
	// Fallback: strip tags with regex (for testing without DOM)
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseXml(xmlString: string): Document {
	if (typeof DOMParser !== 'undefined') {
		return new DOMParser().parseFromString(xmlString, 'application/xml');
	}
	throw new Error('DOMParser not available');
}

function getTextContent(el: Element | null): string {
	return el?.textContent?.trim() ?? '';
}

export async function importEpub(data: ArrayBuffer, filename: string): Promise<ContentResult> {
	const zip = await JSZip.loadAsync(data);

	// 1. Find OPF path from container.xml
	const containerXml = await zip.file('META-INF/container.xml')?.async('string');
	if (!containerXml) throw new Error("Couldn't read this file");

	const containerDoc = parseXml(containerXml);
	const rootfilePath =
		containerDoc.querySelector('rootfile')?.getAttribute('full-path') ?? '';
	if (!rootfilePath) throw new Error("Couldn't read this file");

	// 2. Parse OPF for metadata, manifest, spine
	const opfXml = await zip.file(rootfilePath)?.async('string');
	if (!opfXml) throw new Error("Couldn't read this file");

	const opfDoc = parseXml(opfXml);
	const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

	// Title
	const titleEl = opfDoc.querySelector('metadata *|title') ?? opfDoc.querySelector('dc\\:title');
	const title = getTextContent(titleEl) || filename.replace(/\.epub$/i, '');

	// Manifest: id → href mapping
	const manifest = new Map<string, string>();
	opfDoc.querySelectorAll('manifest item').forEach((item) => {
		const id = item.getAttribute('id');
		const href = item.getAttribute('href');
		if (id && href) manifest.set(id, href);
	});

	// Spine: ordered list of content item IDs
	const spineRefs: string[] = [];
	opfDoc.querySelectorAll('spine itemref').forEach((ref) => {
		const idref = ref.getAttribute('idref');
		if (idref) spineRefs.push(idref);
	});

	// 3. Try to parse TOC (NCX) for chapter names
	const tocId = opfDoc.querySelector('spine')?.getAttribute('toc');
	const tocHref = tocId ? manifest.get(tocId) : undefined;
	const tocMap = new Map<string, string>(); // href → chapter title

	if (tocHref) {
		const tocXml = await zip.file(opfDir + tocHref)?.async('string');
		if (tocXml) {
			const tocDoc = parseXml(tocXml);
			tocDoc.querySelectorAll('navPoint').forEach((np) => {
				const label = np.querySelector('navLabel text')?.textContent?.trim();
				const src = np.querySelector('content')?.getAttribute('src')?.split('#')[0];
				if (label && src) tocMap.set(src, label);
			});
		}
	}

	// 4. Read spine items in order, extract text, build chapters
	const chapters: Chapter[] = [];
	let fullText = '';

	for (const idref of spineRefs) {
		const href = manifest.get(idref);
		if (!href) continue;

		const html = await zip.file(opfDir + href)?.async('string');
		if (!html) continue;

		const chapterTitle = tocMap.get(href);
		if (chapterTitle) {
			chapters.push({ title: chapterTitle, charOffset: fullText.length });
		}

		const text = extractTextFromHtml(html);
		if (text) {
			if (fullText.length > 0) fullText += '\n\n';
			fullText += text;
		}
	}

	return {
		title,
		text: fullText,
		chapters: chapters.length > 0 ? chapters : undefined,
		source: 'file'
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/epub-importer.test.ts 2>&1
```

Expected: All tests PASS. Note: In vitest (jsdom environment), `DOMParser` is available. If not, add `// @vitest-environment jsdom` at the top of the test file.

- [ ] **Step 5: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/importers/epub-importer.ts tests/lib/importers/epub-importer.test.ts
git commit -m "feat: add EPUB importer with chapter extraction (TDD)"
```

---

### Task 10: URL Importer

**Files:**
- Create: `src/lib/importers/url-importer.ts`, `tests/lib/importers/url-importer.test.ts`

- [ ] **Step 1: Write failing URL importer tests**

Create `tests/lib/importers/url-importer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importUrl, extractArticle } from '$lib/importers/url-importer';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('extractArticle', () => {
	it('extracts title and text from HTML', () => {
		const html = `
			<html><head><title>My Article</title></head>
			<body>
				<nav>Site Nav</nav>
				<article>
					<h1>My Article</h1>
					<p>This is the first paragraph of a reasonably long article that should be picked up by readability.</p>
					<p>This is a second paragraph with enough content to make readability consider this the main content of the page.</p>
					<p>And a third paragraph to ensure we have enough text content for the algorithm to work with properly here.</p>
				</article>
				<footer>Footer stuff</footer>
			</body></html>
		`;
		const result = extractArticle(html, 'https://example.com/article');
		expect(result).not.toBeNull();
		expect(result!.title).toBe('My Article');
		expect(result!.text).toContain('first paragraph');
	});
});

describe('importUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('fetches URL through CORS proxy and extracts article', async () => {
		const html = `
			<html><head><title>Test Article</title></head>
			<body><article>
				<h1>Test Article</h1>
				<p>A full article paragraph with substantial content that readability will parse correctly as main content.</p>
				<p>Another paragraph with additional content to ensure readability treats this as an article.</p>
				<p>Third paragraph providing more context and substance for the readability algorithm to work with.</p>
			</article></body></html>
		`;
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () => Promise.resolve(html)
		});

		const result = await importUrl('https://example.com/article');
		expect(result.source).toBe('url');
		expect(result.title).toBe('Test Article');
		expect(result.text).toContain('full article paragraph');
	});

	it('throws on fetch failure', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
		await expect(importUrl('https://example.com/404')).rejects.toThrow();
	});

	it('throws when readability cannot extract content', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () => Promise.resolve('<html><body></body></html>')
		});
		await expect(importUrl('https://example.com/empty')).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/url-importer.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement URL importer**

Create `src/lib/importers/url-importer.ts`:

```ts
import { Readability } from '@mozilla/readability';
import type { ContentResult } from '$lib/types';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Extract article content from HTML using Readability.js.
 * Returns null if extraction fails.
 */
export function extractArticle(
	html: string,
	url: string
): { title: string; text: string } | null {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const reader = new Readability(doc, { charThreshold: 50 });
	const article = reader.parse();
	if (!article || !article.textContent?.trim()) return null;
	return {
		title: article.title || new URL(url).hostname,
		text: article.textContent.trim()
	};
}

export async function importUrl(url: string): Promise<ContentResult> {
	const proxyUrl = CORS_PROXY + encodeURIComponent(url);
	const response = await fetch(proxyUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch URL (${response.status})`);
	}

	const html = await response.text();
	const article = extractArticle(html, url);
	if (!article) {
		throw new Error(
			'Could not extract article content. Try pasting the text directly instead.'
		);
	}

	return {
		title: article.title,
		text: article.text,
		source: 'url'
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run tests/lib/importers/url-importer.test.ts 2>&1
```

Expected: All tests PASS. If DOMParser isn't available in the vitest environment, add `// @vitest-environment jsdom` to the test file.

- [ ] **Step 5: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/lib/importers/url-importer.ts tests/lib/importers/url-importer.test.ts
git commit -m "feat: add URL importer with Readability.js extraction (TDD)"
```

---

### Task 11: Root Layout & Global Styles

**Files:**
- Create: `src/routes/+layout.svelte`
- Modify: `src/app.html`

- [ ] **Step 1: Update app.html to include theme attribute**

Replace `src/app.html`:

```html
<!doctype html>
<html lang="en" data-theme="dark">
	<head>
		<meta charset="utf-8" />
		<link rel="icon" href="%sveltekit.assets%/favicon.png" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		%sveltekit.head%
	</head>
	<body>
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

- [ ] **Step 2: Create root layout with nav**

Create `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	let { children } = $props();

	let isReaderPage = $derived($page.url.pathname === '/read');
</script>

{#if !isReaderPage}
	<nav class="flex items-center justify-between px-6 py-3 border-b" style="background-color: var(--bg-surface); border-color: var(--border);">
		<a href="/" class="text-lg font-bold no-underline" style="color: var(--text);">RSVP Reader</a>
		<div class="flex gap-4">
			<a href="/" class="no-underline text-sm" style="color: var(--text-muted);">Home</a>
			<a href="/library" class="no-underline text-sm" style="color: var(--text-muted);">Library</a>
		</div>
	</nav>
{/if}

{@render children()}
```

- [ ] **Step 3: Verify the layout renders**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run dev -- --port 5173 &
sleep 3 && curl -s http://localhost:5173 | grep -o 'RSVP Reader'
kill %1 2>/dev/null
```

Expected: Output contains "RSVP Reader".

- [ ] **Step 4: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/app.html src/routes/+layout.svelte
git commit -m "feat: add root layout with nav bar and theme support"
```

---

### Task 12: Home Page

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Implement home page with three input methods**

Replace `src/routes/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { importTextFile } from '$lib/importers/text-importer';
	import { importPastedText } from '$lib/importers/paste-importer';
	import { importEpub } from '$lib/importers/epub-importer';
	import { importUrl } from '$lib/importers/url-importer';
	import { parseText } from '$lib/engine/parser';
	import { createLibraryStore } from '$lib/storage/library.svelte';
	import { createPreferencesStore } from '$lib/storage/preferences.svelte';
	import type { ContentResult } from '$lib/types';

	const library = createLibraryStore();
	const preferences = createPreferencesStore();

	let pasteText = $state('');
	let urlInput = $state('');
	let error = $state('');
	let loading = $state(false);
	let dragOver = $state(false);

	async function handleContent(content: ContentResult, sourceRef: string) {
		const tokens = parseText(content.text, content.chapters);
		if (tokens.length === 0) {
			error = 'No readable text found';
			return;
		}

		// Generate ID from title + source
		const id = btoa(encodeURIComponent(content.title + content.source)).slice(0, 32);

		library.save({
			id,
			title: content.title,
			source: content.source,
			sourceRef,
			currentIndex: 0,
			totalWords: tokens.length,
			chapters: content.chapters?.map((ch) => {
				const ratio = content.text.length > 0 ? ch.charOffset / content.text.length : 0;
				const wordOffset = Math.round(ratio * tokens.length);
				return { title: ch.title, wordOffset };
			}),
			lastRead: Date.now(),
			wpm: preferences.preferences.defaultWpm,
			cachedText: content.text
		});

		goto(`/read?id=${encodeURIComponent(id)}`);
	}

	async function handleFile(file: File) {
		error = '';
		loading = true;
		try {
			if (file.name.endsWith('.txt')) {
				const text = await file.text();
				const content = importTextFile(text, file.name);
				await handleContent(content, file.name);
			} else if (file.name.endsWith('.epub')) {
				const buf = await file.arrayBuffer();
				const content = await importEpub(buf, file.name);
				await handleContent(content, file.name);
			} else {
				error = 'Unsupported file type. Please use .txt or .epub files.';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't read this file";
		} finally {
			loading = false;
		}
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	async function handlePaste() {
		error = '';
		if (!pasteText.trim()) {
			error = 'Please paste some text first';
			return;
		}
		const content = importPastedText(pasteText);
		await handleContent(content, 'pasted');
	}

	async function handleUrl() {
		error = '';
		if (!urlInput.trim()) {
			error = 'Please enter a URL';
			return;
		}
		loading = true;
		try {
			const content = await importUrl(urlInput);
			await handleContent(content, urlInput);
		} catch (e) {
			error = e instanceof Error
				? e.message
				: 'Failed to fetch URL. Try pasting the text directly instead.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto p-8">
	<div class="text-center mb-12">
		<h1 class="text-3xl font-bold mb-2" style="color: var(--text);">RSVP Reader</h1>
		<p style="color: var(--text-muted);">Speed read any text, one word at a time</p>
	</div>

	{#if error}
		<div class="mb-6 p-3 rounded text-sm" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{error}
		</div>
	{/if}

	<!-- File Upload -->
	<section class="mb-8">
		<h2 class="text-sm font-semibold uppercase tracking-wide mb-3" style="color: var(--text-muted);">Upload File</h2>
		<div
			class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
			style="border-color: {dragOver ? 'var(--accent)' : 'var(--border)'}; background-color: {dragOver ? 'rgba(255,107,107,0.05)' : 'transparent'};"
			role="button"
			tabindex="0"
			ondrop={onDrop}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
			onclick={() => document.getElementById('file-input')?.click()}
			onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('file-input')?.click(); }}
		>
			<p style="color: var(--text-muted);">Drop a .txt or .epub file here, or click to browse</p>
			<input id="file-input" type="file" accept=".txt,.epub" class="hidden" onchange={onFileInput} />
		</div>
	</section>

	<!-- Paste Text -->
	<section class="mb-8">
		<h2 class="text-sm font-semibold uppercase tracking-wide mb-3" style="color: var(--text-muted);">Paste Text</h2>
		<textarea
			bind:value={pasteText}
			placeholder="Paste your text here..."
			rows="4"
			class="w-full p-3 rounded-lg border text-sm resize-y"
			style="background-color: var(--bg-surface); color: var(--text); border-color: var(--border);"
		></textarea>
		<button
			onclick={handlePaste}
			class="mt-2 px-4 py-2 rounded text-sm font-medium cursor-pointer"
			style="background-color: var(--accent); color: white;"
		>
			Start Reading
		</button>
	</section>

	<!-- URL Input -->
	<section class="mb-8">
		<h2 class="text-sm font-semibold uppercase tracking-wide mb-3" style="color: var(--text-muted);">From URL</h2>
		<div class="flex gap-2">
			<input
				bind:value={urlInput}
				type="url"
				placeholder="https://example.com/article"
				class="flex-1 p-3 rounded-lg border text-sm"
				style="background-color: var(--bg-surface); color: var(--text); border-color: var(--border);"
				onkeydown={(e) => { if (e.key === 'Enter') handleUrl(); }}
			/>
			<button
				onclick={handleUrl}
				disabled={loading}
				class="px-4 py-2 rounded text-sm font-medium cursor-pointer"
				style="background-color: var(--accent); color: white; opacity: {loading ? 0.6 : 1};"
			>
				{loading ? 'Fetching...' : 'Fetch'}
			</button>
		</div>
	</section>
</div>
```

- [ ] **Step 2: Verify home page renders**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run dev -- --port 5173 &
sleep 3 && curl -s http://localhost:5173 | grep -o 'Upload File'
kill %1 2>/dev/null
```

Expected: Output contains "Upload File".

- [ ] **Step 3: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/routes/+page.svelte
git commit -m "feat: add home page with file upload, paste, and URL import"
```

---

### Task 13: Reader Page with Controls

**Files:**
- Create: `src/routes/read/+page.svelte`

- [ ] **Step 1: Implement reader page**

Create `src/routes/read/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createReaderEngine } from '$lib/engine/reader-engine.svelte';
	import { parseText } from '$lib/engine/parser';
	import { createLibraryStore } from '$lib/storage/library.svelte';
	import { createPreferencesStore } from '$lib/storage/preferences.svelte';
	import { createThemeStore } from '$lib/theme/theme.svelte';
	import type { LibraryEntry, Chapter } from '$lib/types';

	const library = createLibraryStore();
	const preferences = createPreferencesStore();
	const theme = createThemeStore(preferences);
	const engine = createReaderEngine();

	let entry = $state<LibraryEntry | null>(null);
	let chapters = $state<Chapter[] | undefined>(undefined);
	let wpmPulse = $state(false);
	let pulseTimeout: ReturnType<typeof setTimeout> | null = null;
	let saveInterval: ReturnType<typeof setInterval> | null = null;
	let storageWarning = $state('');

	// Derived
	let currentChapter = $derived.by(() => {
		if (!entry?.chapters || !engine.currentToken) return '';
		const ci = engine.currentToken.chapterIndex;
		if (ci === undefined || !entry.chapters[ci]) return '';
		return entry.chapters[ci].title;
	});

	let orpParts = $derived.by(() => {
		const token = engine.currentToken;
		if (!token) return { before: '', focus: '', after: '' };
		const text = token.text;
		const orp = token.orp;
		return {
			before: text.slice(0, orp),
			focus: text[orp] ?? '',
			after: text.slice(orp + 1)
		};
	});

	let progressPercent = $derived(Math.round(engine.progress * 100));

	onMount(() => {
		const id = $page.url.searchParams.get('id');
		if (!id) {
			goto('/');
			return;
		}

		entry = library.getById(id) ?? null;
		if (!entry) {
			goto('/');
			return;
		}

		// Parse cached text
		const contentChapters: Chapter[] | undefined = entry.chapters?.map((ch) => ({
			title: ch.title,
			charOffset: 0 // We re-derive from wordOffset at display time
		}));

		const tokens = parseText(entry.cachedText, contentChapters);
		engine.loadTokens(tokens);
		engine.wpm = entry.wpm;
		engine.variableSpeed = preferences.preferences.variableSpeed;
		engine.pauseAtPunctuation = preferences.preferences.pauseAtPunctuation;

		// Restore position
		if (entry.currentIndex > 0 && entry.currentIndex < tokens.length) {
			engine.seekTo(entry.currentIndex / tokens.length);
		}

		// Auto-save progress every 5 seconds
		saveInterval = setInterval(saveProgress, 5000);
	});

	onDestroy(() => {
		saveProgress();
		engine.destroy();
		if (saveInterval) clearInterval(saveInterval);
		if (pulseTimeout) clearTimeout(pulseTimeout);
	});

	function saveProgress() {
		if (!entry) return;
		const success = library.save({
			...entry,
			currentIndex: engine.currentIndex,
			wpm: engine.wpm,
			lastRead: Date.now()
		});
		if (!success) {
			storageWarning = "Progress won't be saved — storage full";
		}
	}

	function exit() {
		saveProgress();
		engine.stop();
		goto('/');
	}

	function adjustWpm(delta: number) {
		const newWpm = Math.max(100, Math.min(1000, engine.wpm + delta));
		engine.wpm = newWpm;

		// Pulse animation
		wpmPulse = true;
		if (pulseTimeout) clearTimeout(pulseTimeout);
		pulseTimeout = setTimeout(() => { wpmPulse = false; }, 300);
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.code) {
			case 'Space':
				e.preventDefault();
				if (engine.status === 'playing') engine.pause();
				else engine.play();
				break;
			case 'Escape':
				exit();
				break;
			case 'ArrowLeft':
				engine.skipBack(5);
				break;
			case 'ArrowRight':
				engine.skipForward(5);
				break;
			case 'ArrowUp':
				e.preventDefault();
				adjustWpm(e.shiftKey ? 1 : preferences.preferences.wpmStepSize);
				break;
			case 'ArrowDown':
				e.preventDefault();
				adjustWpm(e.shiftKey ? -1 : -preferences.preferences.wpmStepSize);
				break;
			case 'Home':
				engine.seekTo(0);
				break;
			case 'End':
				engine.seekTo(1);
				break;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const direction = e.deltaY < 0 ? 1 : -1;
		const step = e.shiftKey ? 1 : preferences.preferences.wpmStepSize;
		adjustWpm(direction * step);
	}

	function handleProgressClick(e: MouseEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const progress = (e.clientX - rect.left) / rect.width;
		engine.seekTo(Math.max(0, Math.min(1, progress)));
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="h-screen flex flex-col select-none"
	style="background-color: var(--bg);"
	onwheel={handleWheel}
>
	<!-- Info Bar -->
	<div
		class="flex justify-between items-center px-4 py-2 text-xs"
		style="color: var(--text-muted); border-bottom: 1px solid var(--border);"
	>
		<button
			onclick={exit}
			class="cursor-pointer bg-transparent border-none text-xs"
			style="color: var(--text-muted);"
		>
			&larr; Back
		</button>
		<span>{currentChapter}</span>
		<div class="flex gap-4 items-center">
			<span>{progressPercent}%</span>
			<span
				class="transition-all duration-150"
				style="font-size: {wpmPulse ? '16px' : '12px'}; font-weight: {wpmPulse ? 'bold' : 'normal'}; color: {wpmPulse ? 'var(--accent)' : 'var(--text-muted)'};"
			>
				{engine.wpm} WPM
			</span>
			<button
				onclick={() => theme.toggle()}
				class="cursor-pointer bg-transparent border-none text-xs"
				style="color: var(--text-muted);"
			>
				{theme.current === 'dark' ? '☀' : '☾'}
			</button>
		</div>
	</div>

	{#if storageWarning}
		<div class="px-4 py-1 text-xs text-center" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{storageWarning}
		</div>
	{/if}

	<!-- Word Display -->
	<div class="flex-1 flex items-center justify-center">
		<div class="text-center">
			<!-- ORP Guide (top) -->
			<div class="text-xs mb-1" style="color: var(--border); letter-spacing: {orpParts.before.length * 0.6}em;">
				|
			</div>

			<!-- Word with ORP highlight -->
			<div class="font-bold" style="font-size: 60px; line-height: 1.2;">
				<span style="color: var(--text-muted);">{orpParts.before}</span><span style="color: var(--accent);">{orpParts.focus}</span><span style="color: var(--text-muted);">{orpParts.after}</span>
			</div>

			<!-- ORP Guide (bottom) -->
			<div class="text-xs mt-1" style="color: var(--border); letter-spacing: {orpParts.before.length * 0.6}em;">
				|
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="px-6 pb-6" style="border-top: 1px solid var(--border);">
		<!-- Progress Bar -->
		<div
			class="h-1 rounded-full mt-4 mb-4 cursor-pointer"
			style="background-color: var(--border);"
			role="progressbar"
			aria-valuenow={progressPercent}
			onclick={handleProgressClick}
		>
			<div
				class="h-1 rounded-full transition-all duration-100"
				style="background-color: var(--accent); width: {engine.progress * 100}%;"
			></div>
		</div>

		<!-- Transport Controls -->
		<div class="flex justify-center items-center gap-6">
			<button
				onclick={() => engine.skipBack(5)}
				class="text-2xl cursor-pointer bg-transparent border-none"
				style="color: var(--text-muted);"
				aria-label="Skip back"
			>⏮</button>

			<button
				onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
				class="text-4xl cursor-pointer bg-transparent border-none"
				style="color: var(--accent);"
				aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
			>
				{engine.status === 'playing' ? '⏸' : '▶'}
			</button>

			<button
				onclick={() => engine.skipForward(5)}
				class="text-2xl cursor-pointer bg-transparent border-none"
				style="color: var(--text-muted);"
				aria-label="Skip forward"
			>⏭</button>
		</div>
	</div>
</div>
```

- [ ] **Step 2: Verify the reader page loads**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run build 2>&1 | tail -5
```

Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/routes/read/
git commit -m "feat: add reader page with ORP display, controls, and keyboard/scroll input"
```

---

### Task 14: Library Page

**Files:**
- Create: `src/routes/library/+page.svelte`

- [ ] **Step 1: Implement library page**

Create `src/routes/library/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { createLibraryStore } from '$lib/storage/library.svelte';

	const library = createLibraryStore();

	let sortedEntries = $derived(
		[...library.entries].sort((a, b) => b.lastRead - a.lastRead)
	);

	function resume(id: string) {
		goto(`/read?id=${encodeURIComponent(id)}`);
	}

	function remove(e: Event, id: string) {
		e.stopPropagation();
		library.remove(id);
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function sourceIcon(source: string): string {
		switch (source) {
			case 'file': return '📄';
			case 'paste': return '📋';
			case 'url': return '🔗';
			default: return '📄';
		}
	}
</script>

<div class="max-w-2xl mx-auto p-8">
	<h1 class="text-2xl font-bold mb-6" style="color: var(--text);">Library</h1>

	{#if sortedEntries.length === 0}
		<div class="text-center py-16">
			<p style="color: var(--text-muted);">No reading history yet.</p>
			<a href="/" class="text-sm mt-2 inline-block" style="color: var(--accent);">Import something to read</a>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each sortedEntries as entry (entry.id)}
				<button
					onclick={() => resume(entry.id)}
					class="w-full text-left p-4 rounded-lg border cursor-pointer flex items-center gap-4 transition-colors"
					style="background-color: var(--bg-surface); border-color: var(--border);"
				>
					<span class="text-xl">{sourceIcon(entry.source)}</span>
					<div class="flex-1 min-w-0">
						<div class="font-medium truncate" style="color: var(--text);">{entry.title}</div>
						<div class="text-xs mt-1 flex gap-3" style="color: var(--text-muted);">
							<span>{Math.round((entry.currentIndex / entry.totalWords) * 100)}% complete</span>
							<span>{entry.totalWords} words</span>
							<span>{formatDate(entry.lastRead)}</span>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<!-- Progress ring -->
						<div class="w-10 h-10 relative">
							<svg viewBox="0 0 36 36" class="w-10 h-10">
								<path
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
									fill="none"
									stroke="var(--border)"
									stroke-width="3"
								/>
								<path
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
									fill="none"
									stroke="var(--accent)"
									stroke-width="3"
									stroke-dasharray="{Math.round((entry.currentIndex / entry.totalWords) * 100)}, 100"
								/>
							</svg>
						</div>
						<button
							onclick={(e) => remove(e, entry.id)}
							class="text-sm cursor-pointer bg-transparent border-none px-2"
							style="color: var(--text-muted);"
							aria-label="Remove from library"
						>✕</button>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add src/routes/library/
git commit -m "feat: add library page with reading history and progress"
```

---

### Task 15: Integration, Error Handling & Final Verification

**Files:**
- Modify: `src/routes/+page.svelte` (minor fixes if needed)
- Modify: `src/routes/read/+page.svelte` (minor fixes if needed)

- [ ] **Step 1: Run all tests**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run 2>&1
```

Expected: All tests pass. If any fail, fix them before proceeding.

- [ ] **Step 2: Run type checking**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx svelte-check --tsconfig ./tsconfig.json 2>&1
```

Expected: No errors. If there are type errors, fix them.

- [ ] **Step 3: Build for production**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run build 2>&1
```

Expected: Build succeeds, outputs to `build/` directory.

- [ ] **Step 4: Verify build output exists**

```bash
ls -la /home/ratan/personal/rsvp-reader-v2/build/index.html
```

Expected: `index.html` exists (the SPA fallback page).

- [ ] **Step 5: Run the preview server to manually verify**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npm run preview -- --port 4173 &
sleep 2 && curl -s http://localhost:4173 | grep -o 'RSVP Reader'
kill %1 2>/dev/null
```

Expected: "RSVP Reader" appears — the built SPA serves correctly.

- [ ] **Step 6: Add .gitignore entries for build output**

Verify `.gitignore` includes:
```
build/
.svelte-kit/
node_modules/
```

If any are missing, add them.

- [ ] **Step 7: Final commit**

```bash
cd /home/ratan/personal/rsvp-reader-v2
git add -A
git commit -m "feat: integration pass — verify tests, types, and production build"
```

- [ ] **Step 8: Run full test suite one final time**

```bash
cd /home/ratan/personal/rsvp-reader-v2 && npx vitest run 2>&1
```

Expected: All tests pass. The MVP is complete.

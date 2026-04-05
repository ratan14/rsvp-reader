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
		vi.useRealTimers();
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
		expect(engine.currentIndex).toBe(1);
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
		vi.advanceTimersByTime(200);
		vi.advanceTimersByTime(200);
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
		engine.seekTo(0.8);
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
});

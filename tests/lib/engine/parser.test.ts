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
		expect(tokens[0].orp).toBe(2);
	});

	it('handles multiple whitespace and newlines', () => {
		const tokens = parseText('hello   world\n\nfoo   bar');
		expect(tokens).toHaveLength(5); // hello, world, <break>, foo, bar
		expect(tokens.filter(t => !t.isParagraphBreak).map((t) => t.text)).toEqual(['hello', 'world', 'foo', 'bar']);
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
		const chapters: Chapter[] = [
			{ title: 'Chapter 1', charOffset: 0 },
			{ title: 'Chapter 2', charOffset: 12 }
		];
		const tokens = parseText(text, chapters);
		expect(tokens[0].chapterIndex).toBe(0);
		expect(tokens[1].chapterIndex).toBe(0);
		expect(tokens[2].chapterIndex).toBe(0);
		expect(tokens[3].chapterIndex).toBe(1);
		expect(tokens[4].chapterIndex).toBe(1);
		expect(tokens[5].chapterIndex).toBe(1);
	});

	it('handles no chapters (all chapterIndex undefined)', () => {
		const tokens = parseText('hello world');
		expect(tokens[0].chapterIndex).toBeUndefined();
		expect(tokens[1].chapterIndex).toBeUndefined();
	});

	it('splits on non-breaking spaces and other Unicode spaces', () => {
		// U+00A0 non-breaking space between words
		const tokens = parseText('scowled.\u00A0\u201CThere');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].text).toBe('scowled.');
		expect(tokens[1].text).toBe('\u201CThere');
	});

	it('preserves punctuation attached to words', () => {
		const tokens = parseText('Hello, world!');
		expect(tokens[0].text).toBe('Hello,');
		expect(tokens[1].text).toBe('world!');
	});

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
});

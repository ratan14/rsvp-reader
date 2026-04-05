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

	it('preserves punctuation attached to words', () => {
		const tokens = parseText('Hello, world!');
		expect(tokens[0].text).toBe('Hello,');
		expect(tokens[1].text).toBe('world!');
	});
});

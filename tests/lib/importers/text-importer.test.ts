import { describe, it, expect } from 'vitest';
import { importTextFile } from '$lib/importers/text-importer';

describe('importTextFile', () => {
	it('returns ContentResult with text and filename as title', () => {
		const result = importTextFile('Hello world, this is a test.', 'my-book.txt');
		expect(result.title).toBe('my-book');
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

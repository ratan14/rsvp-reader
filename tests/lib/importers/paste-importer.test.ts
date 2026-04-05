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

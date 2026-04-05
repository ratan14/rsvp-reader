import { describe, it, expect } from 'vitest';
import { calculateOrp } from '$lib/engine/orp';

describe('calculateOrp', () => {
	// Lookup table based on LETTER count (A-Z only):
	// 1-2→0th letter, 3-6→1st, 7-10→2nd, 11-13→3rd, 14+→4th

	it('returns 0 for single-character words', () => {
		expect(calculateOrp('a')).toBe(0);
	});

	it('returns 0 for two-character words', () => {
		expect(calculateOrp('to')).toBe(0);
	});

	it('returns 1 for three-letter words', () => {
		expect(calculateOrp('the')).toBe(1);
	});

	it('returns 1 for five-letter words', () => {
		expect(calculateOrp('hello')).toBe(1);
	});

	it('returns 2 for nine-letter words', () => {
		expect(calculateOrp('discovery')).toBe(2);
	});

	it('returns 3 for eleven-letter words', () => {
		expect(calculateOrp('information')).toBe(3);
	});

	it('returns 4 for fourteen+ letter words', () => {
		expect(calculateOrp('representations')).toBe(4);
	});

	it('returns 0 for empty string', () => {
		expect(calculateOrp('')).toBe(0);
	});

	// Punctuation and quotes should not count toward word length
	it('ignores leading quote when calculating ORP', () => {
		// \u201CThere — 5 letters, OVP = 1st letter (0-indexed) = 'h' at index 2
		expect(calculateOrp('\u201CThere')).toBe(2);
	});

	it('ignores trailing punctuation when calculating ORP', () => {
		// hello, — 5 letters, OVP = 1st letter = 'e' at index 1
		expect(calculateOrp('hello,')).toBe(1);
	});

	it('ignores surrounding quotes', () => {
		// "hi" — 2 letters, OVP = 0th letter = 'h' at index 1
		expect(calculateOrp('"hi"')).toBe(1);
	});

	it('handles token with no letters', () => {
		expect(calculateOrp('...')).toBe(0);
		expect(calculateOrp('—')).toBe(0);
	});

	it('handles word with trailing period', () => {
		// Reserved. — 8 letters, OVP = 2nd letter = 's' at index 2
		expect(calculateOrp('Reserved.')).toBe(2);
	});
});

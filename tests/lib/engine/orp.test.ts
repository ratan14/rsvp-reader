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
		expect(calculateOrp('discovery')).toBe(2);
	});

	it('returns 1 for four-character words', () => {
		expect(calculateOrp('word')).toBe(1);
	});

	it('handles very long words', () => {
		const word = 'extraordinary'; // 13 chars
		const orp = calculateOrp(word);
		expect(orp).toBe(4);
	});

	it('returns 0 for empty string', () => {
		expect(calculateOrp('')).toBe(0);
	});
});

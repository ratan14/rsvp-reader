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

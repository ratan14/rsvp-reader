import { describe, it, expect } from 'vitest';
import { calculateDelay } from '$lib/engine/timing';

describe('calculateDelay', () => {
	const baseWpm = 300;

	it('returns base delay for a 5-letter word with no adjustments', () => {
		const delay = calculateDelay('hello', baseWpm, false, false);
		expect(delay).toBe(200);
	});

	it('increases delay for long words when variableSpeed is on', () => {
		const delay = calculateDelay('extraordinary', baseWpm, true, false);
		expect(delay).toBe(400);
	});

	it('decreases delay for short words when variableSpeed is on', () => {
		const delay = calculateDelay('at', baseWpm, true, false);
		expect(delay).toBe(160);
	});

	it('clamps factor to minimum 0.8', () => {
		const delay = calculateDelay('I', baseWpm, true, false);
		expect(delay).toBe(160);
	});

	it('clamps factor to maximum 2.0', () => {
		const delay = calculateDelay('abcdefghijklmnop', baseWpm, true, false);
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
		const delay = calculateDelay('end.', baseWpm, true, true);
		expect(delay).toBe(320);
	});

	it('ignores punctuation when pauseAtPunctuation is false', () => {
		const delay = calculateDelay('end.', baseWpm, false, false);
		expect(delay).toBe(200);
	});

	it('handles different WPM values', () => {
		const delay = calculateDelay('hello', 600, false, false);
		expect(delay).toBe(100);
	});
});

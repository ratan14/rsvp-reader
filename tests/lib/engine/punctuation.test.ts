import { describe, it, expect } from 'vitest';
import { trailingPunctuation, isSentenceEnd, isClauseEnd, stripWrappers, isLikelyAbbreviation, isNumeric } from '$lib/engine/punctuation';

describe('trailingPunctuation', () => {
	it('returns last char for plain words', () => {
		expect(trailingPunctuation('hello')).toBe('o');
	});

	it('returns period for word ending with period', () => {
		expect(trailingPunctuation('end.')).toBe('.');
	});

	it('looks past straight double quote', () => {
		expect(trailingPunctuation('they?"')).toBe('?');
	});

	it('looks past curly double quote', () => {
		expect(trailingPunctuation('end.\u201D')).toBe('.');
	});

	it('looks past curly single quote', () => {
		expect(trailingPunctuation('end.\u2019')).toBe('.');
	});

	it('looks past straight single quote', () => {
		expect(trailingPunctuation("end.'")).toBe('.');
	});

	it('looks past closing paren', () => {
		expect(trailingPunctuation('true?)')).toBe('?');
	});

	it('looks past multiple wrappers', () => {
		expect(trailingPunctuation('what?"\u2019')).toBe('?');
	});

	it('returns empty for wrapper-only token', () => {
		expect(trailingPunctuation('"\u201D')).toBe('');
	});
});

describe('isSentenceEnd', () => {
	it('detects period', () => {
		expect(isSentenceEnd('end.')).toBe(true);
	});

	it('detects question mark', () => {
		expect(isSentenceEnd('what?')).toBe(true);
	});

	it('detects exclamation', () => {
		expect(isSentenceEnd('wow!')).toBe(true);
	});

	it('detects ellipsis character', () => {
		expect(isSentenceEnd('away\u2026')).toBe(true);
	});

	it('detects period through triple dot (last char is .)', () => {
		expect(isSentenceEnd('away...')).toBe(true);
	});

	it('detects question mark through closing quote', () => {
		expect(isSentenceEnd('they?\u201D')).toBe(true);
	});

	it('detects period through closing single quote', () => {
		expect(isSentenceEnd("end.'")).toBe(true);
	});

	it('returns false for plain word', () => {
		expect(isSentenceEnd('hello')).toBe(false);
	});

	it('returns false for comma', () => {
		expect(isSentenceEnd('hello,')).toBe(false);
	});

	it('returns false for abbreviation Dr.', () => {
		expect(isSentenceEnd('Dr.')).toBe(false);
	});

	it('returns false for abbreviation U.S.A.', () => {
		expect(isSentenceEnd('U.S.A.')).toBe(false);
	});

	it('returns false for abbreviation etc.', () => {
		expect(isSentenceEnd('etc.')).toBe(false);
	});

	it('returns false for quoted abbreviation', () => {
		expect(isSentenceEnd('"Dr."')).toBe(false);
	});

	it('still returns true for regular sentence end', () => {
		expect(isSentenceEnd('done.')).toBe(true);
	});
});

describe('isClauseEnd', () => {
	it('detects comma', () => {
		expect(isClauseEnd('said,')).toBe(true);
	});

	it('detects semicolon', () => {
		expect(isClauseEnd('first;')).toBe(true);
	});

	it('detects colon', () => {
		expect(isClauseEnd('note:')).toBe(true);
	});

	it('detects em dash', () => {
		expect(isClauseEnd('word\u2014')).toBe(true);
	});

	it('detects en dash', () => {
		expect(isClauseEnd('word\u2013')).toBe(true);
	});

	it('detects comma through closing quote', () => {
		expect(isClauseEnd('said,\u201D')).toBe(true);
	});

	it('returns false for period', () => {
		expect(isClauseEnd('end.')).toBe(false);
	});

	it('returns false for plain word', () => {
		expect(isClauseEnd('hello')).toBe(false);
	});
});

describe('stripWrappers', () => {
	it('returns plain word unchanged', () => {
		expect(stripWrappers('hello')).toBe('hello');
	});

	it('strips trailing quote', () => {
		expect(stripWrappers('Dr."')).toBe('Dr.');
	});

	it('strips leading and trailing quotes', () => {
		expect(stripWrappers('"Dr."')).toBe('Dr.');
	});

	it('strips curly quotes', () => {
		expect(stripWrappers('\u201CDr.\u201D')).toBe('Dr.');
	});

	it('strips parens', () => {
		expect(stripWrappers('(hello)')).toBe('hello');
	});

	it('returns empty for wrapper-only token', () => {
		expect(stripWrappers('"\u201D')).toBe('');
	});
});

describe('isLikelyAbbreviation', () => {
	it('detects single-letter-dot pattern U.S.A.', () => {
		expect(isLikelyAbbreviation('U.S.A.')).toBe(true);
	});

	it('detects e.g.', () => {
		expect(isLikelyAbbreviation('e.g.')).toBe(true);
	});

	it('detects i.e.', () => {
		expect(isLikelyAbbreviation('i.e.')).toBe(true);
	});

	it('detects a.m.', () => {
		expect(isLikelyAbbreviation('a.m.')).toBe(true);
	});

	it('detects common title Dr.', () => {
		expect(isLikelyAbbreviation('Dr.')).toBe(true);
	});

	it('detects Mr.', () => {
		expect(isLikelyAbbreviation('Mr.')).toBe(true);
	});

	it('detects Mrs.', () => {
		expect(isLikelyAbbreviation('Mrs.')).toBe(true);
	});

	it('detects etc.', () => {
		expect(isLikelyAbbreviation('etc.')).toBe(true);
	});

	it('detects Corp.', () => {
		expect(isLikelyAbbreviation('Corp.')).toBe(true);
	});

	it('detects abbreviation through quotes', () => {
		expect(isLikelyAbbreviation('"Dr."')).toBe(true);
	});

	it('detects abbreviation through curly quotes', () => {
		expect(isLikelyAbbreviation('\u201CDr.\u201D')).toBe(true);
	});

	it('returns false for regular word with period', () => {
		expect(isLikelyAbbreviation('hello.')).toBe(false);
	});

	it('returns false for sentence-ending word', () => {
		expect(isLikelyAbbreviation('end.')).toBe(false);
	});

	it('returns false for plain word', () => {
		expect(isLikelyAbbreviation('hello')).toBe(false);
	});

	it('returns false for question mark', () => {
		expect(isLikelyAbbreviation('what?')).toBe(false);
	});
});

describe('isNumeric', () => {
	it('detects plain integer', () => {
		expect(isNumeric('42')).toBe(true);
	});

	it('detects decimal', () => {
		expect(isNumeric('3.99')).toBe(true);
	});

	it('detects currency', () => {
		expect(isNumeric('$3.99')).toBe(true);
	});

	it('detects euro currency', () => {
		expect(isNumeric('€100')).toBe(true);
	});

	it('detects thousands separator', () => {
		expect(isNumeric('3,000')).toBe(true);
	});

	it('detects percentage', () => {
		expect(isNumeric('50%')).toBe(true);
	});

	it('detects time', () => {
		expect(isNumeric('12:30')).toBe(true);
	});

	it('detects fraction', () => {
		expect(isNumeric('1/2')).toBe(true);
	});

	it('detects number in parens', () => {
		expect(isNumeric('(42)')).toBe(true);
	});

	it('detects number in quotes', () => {
		expect(isNumeric('"100"')).toBe(true);
	});

	it('detects year', () => {
		expect(isNumeric('2026')).toBe(true);
	});

	it('returns false for plain word', () => {
		expect(isNumeric('hello')).toBe(false);
	});

	it('returns false for alphanumeric like h2o', () => {
		expect(isNumeric('h2o')).toBe(false);
	});

	it('returns false for ordinal like 4th', () => {
		expect(isNumeric('4th')).toBe(false);
	});

	it('returns false for mixed like COVID-19', () => {
		expect(isNumeric('COVID-19')).toBe(false);
	});
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPreferencesStore } from '$lib/storage/preferences.svelte';
import { DEFAULT_PREFERENCES } from '$lib/types';

const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('PreferencesStore', () => {
	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('returns defaults when nothing is stored', () => {
		const prefs = createPreferencesStore();
		expect(prefs.preferences).toEqual(DEFAULT_PREFERENCES);
	});

	it('loads saved preferences from localStorage', () => {
		const saved = { ...DEFAULT_PREFERENCES, defaultWpm: 500, theme: 'light' as const };
		localStorageMock.setItem('rsvp-preferences', JSON.stringify(saved));
		const prefs = createPreferencesStore();
		expect(prefs.preferences.defaultWpm).toBe(500);
		expect(prefs.preferences.theme).toBe('light');
	});

	it('updates a preference and persists to localStorage', () => {
		const prefs = createPreferencesStore();
		prefs.update({ defaultWpm: 450 });
		expect(prefs.preferences.defaultWpm).toBe(450);
		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'rsvp-preferences',
			expect.stringContaining('"defaultWpm":450')
		);
	});

	it('merges partial updates without losing other fields', () => {
		const prefs = createPreferencesStore();
		prefs.update({ theme: 'light' });
		expect(prefs.preferences.defaultWpm).toBe(DEFAULT_PREFERENCES.defaultWpm);
		expect(prefs.preferences.theme).toBe('light');
	});

	it('handles corrupt localStorage data gracefully', () => {
		localStorageMock.setItem('rsvp-preferences', 'not-json');
		const prefs = createPreferencesStore();
		expect(prefs.preferences).toEqual(DEFAULT_PREFERENCES);
	});
});

import { DEFAULT_PREFERENCES, type UserPreferences } from '$lib/types';

const STORAGE_KEY = 'rsvp-preferences';

function loadFromStorage(): UserPreferences {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_PREFERENCES };
		const parsed = JSON.parse(raw);
		return { ...DEFAULT_PREFERENCES, ...parsed };
	} catch {
		return { ...DEFAULT_PREFERENCES };
	}
}

function saveToStorage(prefs: UserPreferences): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// localStorage full — silently fail
	}
}

export function createPreferencesStore() {
	let preferences = $state<UserPreferences>(loadFromStorage());

	function update(partial: Partial<UserPreferences>) {
		preferences = { ...preferences, ...partial };
		saveToStorage(preferences);
	}

	return {
		get preferences() { return preferences; },
		update
	};
}

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;

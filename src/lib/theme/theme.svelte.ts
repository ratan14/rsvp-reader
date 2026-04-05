import type { PreferencesStore } from '$lib/storage/preferences.svelte';

export function createThemeStore(preferencesStore: PreferencesStore) {
	function apply() {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', preferencesStore.preferences.theme);
		}
	}

	function toggle() {
		const newTheme = preferencesStore.preferences.theme === 'dark' ? 'light' : 'dark';
		preferencesStore.update({ theme: newTheme });
		apply();
	}

	// Apply on creation
	apply();

	return {
		get current() { return preferencesStore.preferences.theme; },
		toggle,
		apply
	};
}

export type ThemeStore = ReturnType<typeof createThemeStore>;

import type { LibraryEntry } from '$lib/types';

const STORAGE_KEY = 'rsvp-library';

function loadFromStorage(): LibraryEntry[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveToStorage(entries: LibraryEntry[]): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
		return true;
	} catch {
		return false;
	}
}

export function createLibraryStore() {
	let entries = $state<LibraryEntry[]>(loadFromStorage());

	function save(entry: LibraryEntry): boolean {
		const idx = entries.findIndex((e) => e.id === entry.id);
		if (idx >= 0) {
			entries[idx] = entry;
		} else {
			entries.push(entry);
		}
		return saveToStorage(entries);
	}

	function remove(id: string) {
		entries = entries.filter((e) => e.id !== id);
		saveToStorage(entries);
	}

	function getById(id: string): LibraryEntry | undefined {
		return entries.find((e) => e.id === id);
	}

	return {
		get entries() { return entries; },
		save,
		remove,
		getById
	};
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;

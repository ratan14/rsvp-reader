import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLibraryStore } from '$lib/storage/library.svelte';
import type { LibraryEntry } from '$lib/types';

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

const makeEntry = (overrides?: Partial<LibraryEntry>): LibraryEntry => ({
	id: 'test-id',
	title: 'Test Book',
	source: 'file',
	sourceRef: 'test.txt',
	currentIndex: 0,
	totalWords: 100,
	lastRead: Date.now(),
	wpm: 300,
	cachedText: 'hello world',
	...overrides
});

describe('LibraryStore', () => {
	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('starts with empty entries when nothing stored', () => {
		const lib = createLibraryStore();
		expect(lib.entries).toEqual([]);
	});

	it('loads entries from localStorage', () => {
		const entry = makeEntry();
		localStorageMock.setItem('rsvp-library', JSON.stringify([entry]));
		const lib = createLibraryStore();
		expect(lib.entries).toHaveLength(1);
		expect(lib.entries[0].title).toBe('Test Book');
	});

	it('saves a new entry', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry());
		expect(lib.entries).toHaveLength(1);
		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'rsvp-library',
			expect.any(String)
		);
	});

	it('updates existing entry by id', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry({ id: 'abc', currentIndex: 0 }));
		lib.save(makeEntry({ id: 'abc', currentIndex: 50 }));
		expect(lib.entries).toHaveLength(1);
		expect(lib.entries[0].currentIndex).toBe(50);
	});

	it('removes an entry by id', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry({ id: 'abc' }));
		lib.save(makeEntry({ id: 'def', title: 'Another' }));
		lib.remove('abc');
		expect(lib.entries).toHaveLength(1);
		expect(lib.entries[0].id).toBe('def');
	});

	it('gets entry by id', () => {
		const lib = createLibraryStore();
		lib.save(makeEntry({ id: 'abc' }));
		expect(lib.getById('abc')?.title).toBe('Test Book');
		expect(lib.getById('nonexistent')).toBeUndefined();
	});

	it('handles corrupt localStorage gracefully', () => {
		localStorageMock.setItem('rsvp-library', 'broken');
		const lib = createLibraryStore();
		expect(lib.entries).toEqual([]);
	});
});

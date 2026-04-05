export interface Token {
	text: string;
	index: number;
	chapterIndex?: number;
	orp: number;
}

export interface Chapter {
	title: string;
	charOffset: number;
}

export interface ContentResult {
	title: string;
	text: string;
	chapters?: Chapter[];
	source: 'file' | 'paste' | 'url';
}

export interface LibraryChapter {
	title: string;
	wordOffset: number;
}

export interface LibraryEntry {
	id: string;
	title: string;
	source: 'file' | 'paste' | 'url';
	sourceRef: string;
	currentIndex: number;
	totalWords: number;
	chapters?: LibraryChapter[];
	lastRead: number;
	wpm: number;
	cachedText: string;
}

export interface UserPreferences {
	defaultWpm: number;
	theme: 'dark' | 'light';
	variableSpeed: boolean;
	pauseAtPunctuation: boolean;
	wpmStepSize: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
	defaultWpm: 300,
	theme: 'dark',
	variableSpeed: true,
	pauseAtPunctuation: true,
	wpmStepSize: 5
};

export type ReaderStatus = 'stopped' | 'playing' | 'paused';

import type { Token, ReaderStatus } from '$lib/types';
import { calculateDelay } from './timing';
import { isSentenceEnd } from './punctuation';

export function createReaderEngine() {
	let tokens = $state<Token[]>([]);
	let currentIndex = $state(0);
	let status = $state<ReaderStatus>('stopped');
	let wpm = $state(300);
	let variableSpeed = $state(true);
	let pauseAtPunctuation = $state(true);
	let timerId: ReturnType<typeof setTimeout> | null = null;

	function scheduleNext() {
		if (status !== 'playing') return;
		if (currentIndex >= tokens.length) {
			stop();
			return;
		}

		const token = tokens[currentIndex];

		if (token.isParagraphBreak) {
			const delay = calculateDelay('', wpm, false, false, true);
			timerId = setTimeout(() => {
				currentIndex++;
				scheduleNext();
			}, delay);
			return;
		}

		const delay = calculateDelay(token.text, wpm, variableSpeed, pauseAtPunctuation);

		timerId = setTimeout(() => {
			currentIndex++;
			scheduleNext();
		}, delay);
	}

	function play() {
		if (tokens.length === 0) return;
		if (status === 'playing') return;
		status = 'playing';
		scheduleNext();
	}

	function pause() {
		if (timerId) clearTimeout(timerId);
		timerId = null;
		status = 'paused';
	}

	function stop() {
		if (timerId) clearTimeout(timerId);
		timerId = null;
		status = 'stopped';
		currentIndex = 0;
	}

	let chapterStarts: number[] = [];

	function loadTokens(newTokens: Token[]) {
		if (timerId) clearTimeout(timerId);
		timerId = null;
		tokens = newTokens;
		currentIndex = 0;
		status = 'stopped';

		chapterStarts = [];
		let lastChapter = -1;
		for (let i = 0; i < newTokens.length; i++) {
			const ci = newTokens[i].chapterIndex;
			if (ci !== undefined && ci !== lastChapter) {
				chapterStarts.push(i);
				lastChapter = ci;
			}
		}
	}

	function getCurrentChapterStartIdx(): number {
		let idx = 0;
		for (let i = 0; i < chapterStarts.length; i++) {
			if (chapterStarts[i] <= currentIndex) idx = i;
			else break;
		}
		return idx;
	}

	function nextChapter() {
		if (chapterStarts.length < 2) return;
		const idx = getCurrentChapterStartIdx();
		if (idx + 1 < chapterStarts.length) {
			currentIndex = skipParagraphs(chapterStarts[idx + 1], 1);
		}
	}

	function prevChapter() {
		if (chapterStarts.length < 2) return;
		const idx = getCurrentChapterStartIdx();
		const chapterStart = chapterStarts[idx];
		if (currentIndex > chapterStart + 5) {
			currentIndex = skipParagraphs(chapterStart, 1);
		} else if (idx > 0) {
			currentIndex = skipParagraphs(chapterStarts[idx - 1], 1);
		} else {
			currentIndex = 0;
		}
	}

	function seekTo(progress: number) {
		let idx = Math.round(progress * tokens.length);
		if (idx >= tokens.length) idx = tokens.length - 1;
		if (idx < 0) idx = 0;
		currentIndex = idx;
	}

	function skipParagraphs(idx: number, direction: 1 | -1): number {
		while (idx >= 0 && idx < tokens.length && tokens[idx].isParagraphBreak) {
			idx += direction;
		}
		if (idx < 0) return 0;
		if (idx >= tokens.length) return tokens.length - 1;
		return idx;
	}

	function skipForward(n: number) {
		let idx = Math.min(currentIndex + n, tokens.length - 1);
		currentIndex = skipParagraphs(idx, 1);
	}

	function skipBack(n: number) {
		let idx = Math.max(currentIndex - n, 0);
		currentIndex = skipParagraphs(idx, -1);
	}

	function nextSentence() {
		for (let i = currentIndex; i < tokens.length; i++) {
			if (tokens[i].isParagraphBreak) continue;
			if (isSentenceEnd(tokens[i].text)) {
				let next = i + 1;
				next = skipParagraphs(next, 1);
				if (next < tokens.length) {
					currentIndex = next;
				}
				return;
			}
		}
		currentIndex = tokens.length - 1;
	}

	function prevSentence() {
		let i = currentIndex - 1;
		while (i >= 0) {
			if (tokens[i].isParagraphBreak) { i--; continue; }
			if (isSentenceEnd(tokens[i].text)) {
				if (i + 1 < currentIndex) {
					currentIndex = skipParagraphs(i + 1, 1);
					return;
				}
				i--;
				while (i >= 0) {
					if (tokens[i].isParagraphBreak) { i--; continue; }
					if (isSentenceEnd(tokens[i].text)) {
						currentIndex = skipParagraphs(i + 1, 1);
						return;
					}
					i--;
				}
				currentIndex = 0;
				return;
			}
			i--;
		}
		currentIndex = 0;
	}

	function destroy() {
		if (timerId) clearTimeout(timerId);
		timerId = null;
	}

	return {
		get tokens() { return tokens; },
		get currentIndex() { return currentIndex; },
		get status() { return status; },
		get wpm() { return wpm; },
		set wpm(v: number) { wpm = v; },
		get variableSpeed() { return variableSpeed; },
		set variableSpeed(v: boolean) { variableSpeed = v; },
		get pauseAtPunctuation() { return pauseAtPunctuation; },
		set pauseAtPunctuation(v: boolean) { pauseAtPunctuation = v; },
		get currentWord() {
			return tokens.length > 0 && currentIndex < tokens.length
				? tokens[currentIndex].text
				: '';
		},
		get currentToken() {
			return tokens.length > 0 && currentIndex < tokens.length
				? tokens[currentIndex]
				: null;
		},
		get progress() {
			return tokens.length === 0 ? 0 : currentIndex / tokens.length;
		},
		play,
		pause,
		stop,
		loadTokens,
		seekTo,
		skipForward,
		skipBack,
		nextSentence,
		prevSentence,
		nextChapter,
		prevChapter,
		get hasChapters() { return chapterStarts.length > 1; },
		destroy
	};
}

export type ReaderEngine = ReturnType<typeof createReaderEngine>;

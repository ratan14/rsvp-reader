<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createReaderEngine } from '$lib/engine/reader-engine.svelte';
	import { parseText } from '$lib/engine/parser';
	import { createLibraryStore } from '$lib/storage/library.svelte';
	import { createPreferencesStore } from '$lib/storage/preferences.svelte';
	import { createThemeStore } from '$lib/theme/theme.svelte';
	import { createLayoutDetector } from '$lib/layout.svelte';
	import WpmJoystick from '$lib/components/WpmJoystick.svelte';
	import type { LibraryEntry, Chapter, Bookmark } from '$lib/types';

	const library = createLibraryStore();
	const preferences = createPreferencesStore();
	const theme = createThemeStore(preferences);
	const engine = createReaderEngine();

	let entry = $state<LibraryEntry | null>(null);
	let wpmPulse = $state(false);
	let pulseTimeout: ReturnType<typeof setTimeout> | null = null;
	let saveInterval: ReturnType<typeof setInterval> | null = null;
	let storageWarning = $state('');
	let showInfoBar = $state(false);
	let infoBarTimeout: ReturnType<typeof setTimeout> | null = null;
	let showBookmarks = $state(false);
	let bookmarkFeedback = $state(false);
	let bookmarkFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	const layout = createLayoutDetector();

	let currentChapter = $derived.by(() => {
		if (!entry?.chapters || !engine.currentToken) return '';
		const ci = engine.currentToken.chapterIndex;
		if (ci === undefined || !entry.chapters[ci]) return '';
		return entry.chapters[ci].title;
	});

	let orpParts = $derived.by(() => {
		const token = engine.currentToken;
		if (!token) return { before: '', focus: '', after: '' };
		const text = token.text;
		const orp = token.orp;
		return {
			before: text.slice(0, orp),
			focus: text[orp] ?? '',
			after: text.slice(orp + 1)
		};
	});

	let wordStrip = $derived.by(() => {
		const ci = engine.currentIndex;
		const toks = engine.tokens;
		if (toks.length === 0 || ci >= toks.length) return { words: [] as Array<{text: string; isCurrent: boolean; distance: number}>, orpCharOffset: 0 };

		const RANGE = 30;
		const startIdx = Math.max(0, ci - RANGE);
		const endIdx = Math.min(toks.length - 1, ci + RANGE);

		const words: Array<{text: string; isCurrent: boolean; distance: number}> = [];
		let currentWordIdx = 0;

		for (let i = startIdx; i <= endIdx; i++) {
			if (toks[i].isParagraphBreak) continue;
			if (i === ci) currentWordIdx = words.length;
			words.push({ text: toks[i].text, isCurrent: i === ci, distance: 0 });
		}

		for (let j = 0; j < words.length; j++) {
			words[j].distance = Math.abs(j - currentWordIdx);
		}

		const PAD = 3;
		let charsBeforeOrp = 0;
		for (let j = 0; j < currentWordIdx; j++) {
			charsBeforeOrp += words[j].text.length + 1;
		}
		charsBeforeOrp += PAD + (toks[ci]?.orp ?? 0);

		return { words, orpCharOffset: charsBeforeOrp };
	});

	let progressPercent = $derived(Math.round(engine.progress * 100));

	let sortedBookmarks = $derived(
		[...(entry?.bookmarks ?? [])].sort((a, b) => a.index - b.index)
	);

	onMount(() => {
		const id = $page.url.searchParams.get('id');
		if (!id) {
			goto('/');
			return;
		}

		entry = library.getById(id) ?? null;
		if (!entry) {
			goto('/');
			return;
		}

		const contentChapters: Chapter[] | undefined = entry.chapters?.map((ch) => ({
			title: ch.title,
			charOffset: entry!.totalWords > 0
				? Math.round((ch.wordOffset / entry!.totalWords) * entry!.cachedText.length)
				: 0
		}));

		const tokens = parseText(entry.cachedText, contentChapters);
		engine.loadTokens(tokens);
		engine.wpm = entry.wpm;
		engine.variableSpeed = preferences.preferences.variableSpeed;
		engine.pauseAtPunctuation = preferences.preferences.pauseAtPunctuation;

		if (entry.currentIndex > 0 && entry.currentIndex < tokens.length) {
			engine.seekTo(entry.currentIndex / tokens.length);
		}

		saveInterval = setInterval(saveProgress, 5000);

		// Save on visibility change / page unload (more reliable than onDestroy on mobile)
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);
		window.addEventListener('beforeunload', handlePageHide);

		// Request fullscreen on mobile/touch devices
		const el = document.documentElement as any;
		(el.requestFullscreen || el.webkitRequestFullscreen)?.call(el).catch(() => {});
	});

	onDestroy(() => {
		saveProgress();
		engine.destroy();
		layout.destroy();
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('pagehide', handlePageHide);
		window.removeEventListener('beforeunload', handlePageHide);
		if (saveInterval) clearInterval(saveInterval);
		if (pulseTimeout) clearTimeout(pulseTimeout);
		if (infoBarTimeout) clearTimeout(infoBarTimeout);
		if (rewindTapTimeout) clearTimeout(rewindTapTimeout);
		if (rewindResumeTimeout) clearTimeout(rewindResumeTimeout);
		if (bookmarkFeedbackTimeout) clearTimeout(bookmarkFeedbackTimeout);
	});

	function saveProgress() {
		if (!entry) return;
		const success = library.save({
			...entry,
			currentIndex: engine.currentIndex,
			wpm: engine.wpm,
			lastRead: Date.now()
		});
		if (!success) {
			storageWarning = "Progress won't be saved — storage full";
		}
	}

	function exit() {
		saveProgress();
		engine.stop();
		(document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document).catch(() => {});
		goto('/');
	}

	function adjustWpm(delta: number) {
		const newWpm = Math.max(100, Math.min(1000, engine.wpm + delta));
		engine.wpm = newWpm;

		wpmPulse = true;
		if (pulseTimeout) clearTimeout(pulseTimeout);
		pulseTimeout = setTimeout(() => { wpmPulse = false; }, 300);
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.code) {
			case 'Space':
				e.preventDefault();
				if (engine.status === 'playing') engine.pause();
				else engine.play();
				break;
			case 'Escape':
				exit();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				if (engine.status === 'playing') engine.pause();
				if (e.shiftKey) engine.prevSentence();
				else engine.skipBack(1);
				break;
			case 'ArrowRight':
				e.preventDefault();
				if (engine.status === 'playing') engine.pause();
				if (e.shiftKey) engine.nextSentence();
				else engine.skipForward(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				adjustWpm(e.shiftKey ? 1 : preferences.preferences.wpmStepSize);
				break;
			case 'ArrowDown':
				e.preventDefault();
				adjustWpm(e.shiftKey ? -1 : -preferences.preferences.wpmStepSize);
				break;
			case 'Home':
				if (engine.status === 'playing') engine.pause();
				engine.seekTo(0);
				break;
			case 'End':
				if (engine.status === 'playing') engine.pause();
				engine.seekTo(1);
				break;
			case 'PageUp':
				e.preventDefault();
				handlePrevChapter();
				break;
			case 'PageDown':
				e.preventDefault();
				handleNextChapter();
				break;
			case 'KeyB':
				e.preventDefault();
				addBookmark();
				break;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const direction = e.deltaY < 0 ? 1 : -1;
		const step = e.shiftKey ? 1 : preferences.preferences.wpmStepSize;
		adjustWpm(direction * step);
	}

	function handleProgressClick(e: MouseEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const progress = (e.clientX - rect.left) / rect.width;
		engine.seekTo(Math.max(0, Math.min(1, progress)));
	}

	function toggleInfoBar() {
		if (infoBarTimeout) clearTimeout(infoBarTimeout);
		showInfoBar = !showInfoBar;
		if (showInfoBar) {
			infoBarTimeout = setTimeout(() => { showInfoBar = false; }, 3000);
		}
	}

	function handleJoystickWpm(newWpm: number) {
		engine.wpm = newWpm;
		wpmPulse = true;
		if (pulseTimeout) clearTimeout(pulseTimeout);
		pulseTimeout = setTimeout(() => { wpmPulse = false; }, 300);
	}

	let rewindTapTimeout: ReturnType<typeof setTimeout> | null = null;
	let rewindResumeTimeout: ReturnType<typeof setTimeout> | null = null;
	let wasPlayingBeforeRewind = false;

	function handleRewindTap() {
		if (rewindTapTimeout) clearTimeout(rewindTapTimeout);
		if (rewindResumeTimeout) clearTimeout(rewindResumeTimeout);

		// Pause playback on first tap, remember if it was playing
		if (engine.status === 'playing') {
			wasPlayingBeforeRewind = true;
			engine.pause();
		}

		engine.prevSentence();

		// After 400ms with no more taps, wait 500ms then resume if it was playing
		rewindTapTimeout = setTimeout(() => {
			if (wasPlayingBeforeRewind) {
				rewindResumeTimeout = setTimeout(() => {
					engine.play();
					wasPlayingBeforeRewind = false;
				}, 500);
			}
		}, 400);
	}

	function exitStopPropagation(e: MouseEvent) {
		e.stopPropagation();
		exit();
	}

	function toggleThemeStopPropagation(e: MouseEvent) {
		e.stopPropagation();
		theme.toggle();
	}

	function handleVisibilityChange() {
		if (document.hidden) saveProgress();
	}

	function handlePageHide() {
		saveProgress();
	}

	function handlePrevChapter() {
		if (engine.status === 'playing') engine.pause();
		addBookmark(true);
		engine.prevChapter();
	}

	function handleNextChapter() {
		if (engine.status === 'playing') engine.pause();
		addBookmark(true);
		engine.nextChapter();
	}

	function addBookmark(auto = false) {
		if (!entry || engine.tokens.length === 0) return;
		const bookmarks = entry.bookmarks ?? [];
		if (bookmarks.some(b => b.index === engine.currentIndex)) return;
		const pct = Math.round(engine.progress * 100);
		const label = currentChapter ? `${currentChapter} · ${pct}%` : `${pct}%`;
		entry.bookmarks = [...bookmarks, {
			index: engine.currentIndex,
			label,
			timestamp: Date.now()
		}];
		saveProgress();
		if (!auto) {
			bookmarkFeedback = true;
			if (bookmarkFeedbackTimeout) clearTimeout(bookmarkFeedbackTimeout);
			bookmarkFeedbackTimeout = setTimeout(() => { bookmarkFeedback = false; }, 800);
		}
	}

	function navigateToBookmark(bm: Bookmark) {
		if (engine.status === 'playing') engine.pause();
		engine.seekTo(bm.index / engine.tokens.length);
		showBookmarks = false;
	}

	function deleteBookmark(timestamp: number) {
		if (!entry) return;
		entry.bookmarks = (entry.bookmarks ?? []).filter(b => b.timestamp !== timestamp);
		saveProgress();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="h-screen flex flex-col select-none relative read-container"
	style="background-color: var(--bg);"
	onwheel={handleWheel}
>
	<!-- Info bar: always visible on large screens, tap-to-reveal on small -->
	{#if !layout.isSmall}
		<div
			class="flex justify-between items-center px-4 py-2 text-xs"
			style="color: var(--text-muted); border-bottom: 1px solid var(--border);"
		>
			<button
				onclick={exit}
				class="cursor-pointer bg-transparent border-none text-xs"
				style="color: var(--text-muted);"
			>&larr; Back</button>
			<span>{currentChapter}</span>
			<div class="flex gap-4 items-center">
				<span>{progressPercent}%</span>
				<span
					class="transition-all duration-150"
					style="font-size: {wpmPulse ? '16px' : '12px'}; font-weight: {wpmPulse ? 'bold' : 'normal'}; color: {wpmPulse ? 'var(--accent)' : 'var(--text-muted)'};"
				>{engine.wpm} WPM</span>
				<button
					onclick={() => theme.toggle()}
					class="cursor-pointer bg-transparent border-none text-xs"
					style="color: var(--text-muted);"
				>{theme.current === 'dark' ? '☀' : '☾'}</button>
			</div>
		</div>
	{/if}

	{#if storageWarning}
		<div class="px-4 py-1 text-xs text-center" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{storageWarning}
		</div>
	{/if}

	<!-- Main content area -->
	<div class="flex-1 flex min-h-0" class:flex-col={!layout.isWide}>
		<!-- Word Display Area -->
		<div
			class="flex-1 flex items-center justify-center overflow-hidden relative"
			onclick={layout.isSmall ? toggleInfoBar : undefined}
			role={layout.isSmall ? 'button' : undefined}
			tabindex={layout.isSmall ? 0 : undefined}
		>
			<!-- Small screen: overlay info bar on tap -->
			{#if layout.isSmall && showInfoBar}
				<div
					class="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-2 text-xs z-20"
					style="background-color: rgba(26,26,46,0.9); color: var(--text-muted); backdrop-filter: blur(4px);"
				>
					<button
						onclick={exitStopPropagation}
						class="cursor-pointer bg-transparent border-none min-w-[44px] min-h-[44px] flex items-center justify-center text-xs"
						style="color: var(--text-muted);"
					>&larr; Back</button>
					<span class="truncate mx-2">{currentChapter}</span>
					<div class="flex gap-3 items-center">
						<span>{progressPercent}%</span>
						<span style="color: var(--accent);">{engine.wpm} WPM</span>
						<button
							onclick={toggleThemeStopPropagation}
							class="cursor-pointer bg-transparent border-none min-w-[44px] min-h-[44px] flex items-center justify-center text-xs"
							style="color: var(--text-muted);"
						>{theme.current === 'dark' ? '☀' : '☾'}</button>
					</div>
				</div>
			{/if}

			<!-- Landscape: sentence rewind button, top-left area -->
			{#if layout.isWide}
				<button
					onclick={(e) => { e.stopPropagation(); handleRewindTap(); }}
					class="absolute z-30 cursor-pointer border-none rounded-2xl flex items-center justify-center"
					style="top: 10px; left: 10px; width: 72px; height: 72px; background-color: var(--text-muted); border: 1px solid var(--border);"
					aria-label="Rewind to start of sentence"
				>
					<!-- Circular rewind arrow: arc from right going counter-clockwise, arrow pointing left -->
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
						<path d="M 8 4.5 A 8.5 8.5 0 1 1 4 12" stroke="var(--bg-surface-raised)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
						<polyline points="8,1 4.5,4.5 8,8" stroke="var(--bg-surface-raised)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
					</svg>
				</button>
			{/if}

			<!-- Bookmarks panel -->
			{#if showBookmarks}
				<div
					class="absolute bottom-2 left-2 right-2 z-40 rounded-lg p-3 max-h-[50%] overflow-y-auto"
					style="background-color: var(--bg-surface); border: 1px solid var(--border);"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="flex justify-between items-center mb-2">
						<span class="text-xs font-semibold" style="color: var(--text);">Bookmarks</span>
						<div class="flex gap-2">
							<button
								onclick={() => addBookmark()}
								class="text-xs cursor-pointer border-none rounded px-2 py-1"
								style="background-color: var(--accent); color: white;"
							>+ Add here</button>
							<button
								onclick={() => showBookmarks = false}
								class="cursor-pointer bg-transparent border-none text-xs"
								style="color: var(--text-muted);"
							>✕</button>
						</div>
					</div>
					{#if sortedBookmarks.length === 0}
						<div class="text-xs py-2" style="color: var(--text-muted);">No bookmarks yet</div>
					{:else}
						{#each sortedBookmarks as bm}
							<div class="flex items-center justify-between py-1.5" style="border-top: 1px solid var(--border);">
								<button
									onclick={() => navigateToBookmark(bm)}
									class="flex-1 text-left cursor-pointer bg-transparent border-none text-xs truncate"
									style="color: var(--text);"
								>{bm.label}</button>
								<button
									onclick={() => deleteBookmark(bm.timestamp)}
									class="cursor-pointer bg-transparent border-none text-xs px-2 shrink-0"
									style="color: var(--text-muted);"
								>✕</button>
							</div>
						{/each}
					{/if}
				</div>
			{/if}

			<!-- Word strip with context -->
			<div class="flex flex-col items-center" style="width: 100%;">
				<div style="color: var(--accent); font-size: 14px;">▼</div>
				<div class="relative overflow-hidden" style="width: 100%;">
					<div
						class="whitespace-pre font-bold"
						style="font-size: var(--word-font-size, 60px); line-height: 1.4; font-family: 'Courier New', Courier, monospace; position: relative; left: 50%; transform: translateX(calc(-0.5ch - {wordStrip.orpCharOffset}ch));"
					>{#each wordStrip.words as word, i}{#if i > 0}{' '}{/if}{#if word.isCurrent}{'   '}<span style="color: var(--text-muted);">{orpParts.before}</span><span style="color: var(--accent);">{orpParts.focus}</span><span style="color: var(--text-muted);">{orpParts.after}</span>{'   '}{:else}<span style="opacity: 0.07; color: var(--text-muted);">{word.text}</span>{/if}{/each}</div>
				</div>
				<div style="color: var(--accent); font-size: 14px;">▲</div>
			</div>
		</div>

		{#if layout.isWide}
			<!-- WIDE: Right-side panel (WPM + joystick) -->
			<div
				class="flex flex-col items-center justify-center gap-2 py-2 px-2 shrink-0"
				style="width: 100px; background-color: var(--bg-surface); border-left: 1px solid var(--border); overflow: visible;"
			>
				<div class="text-center">
					<div class="text-base font-bold" style="color: var(--accent);">{engine.wpm}</div>
					<div class="text-[8px] tracking-widest" style="color: var(--text-muted);">WPM</div>
				</div>
				<WpmJoystick orientation="vertical" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />
			</div>
		{:else}
			<!-- TALL: Controls below -->
			<div style="border-top: 1px solid var(--border);">
				<!-- Progress Bar -->
				<div
					class="cursor-pointer mx-3 mt-4 mb-4 rounded-full relative"
					style="background-color: var(--border); height: var(--progress-height, 4px);"
					role="progressbar"
					aria-valuenow={progressPercent}
					onclick={handleProgressClick}
				>
					<div
						class="rounded-full transition-all duration-100 h-full"
						style="background-color: var(--accent); width: {engine.progress * 100}%;"
					></div>
					{#each sortedBookmarks as bm}
						<div class="absolute" style="left: {(bm.index / engine.tokens.length) * 100}%; top: -3px; bottom: -3px; width: 2px; background-color: var(--text); opacity: 0.5; border-radius: 1px;"></div>
					{/each}
				</div>

				<!-- Transport buttons -->
				<div class="flex justify-center items-center gap-4 pb-3">
					{#if engine.hasChapters}
						<button
							onclick={handlePrevChapter}
							class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2"
							aria-label="Previous chapter"
						>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="var(--text-muted)"><rect x="3" y="5" width="3" height="14"/><polygon points="19,5 8,12 19,19"/></svg>
						</button>
					{/if}
					<button
						onclick={() => engine.skipBack(1)}
						class="cursor-pointer bg-transparent border-none flex items-center justify-center p-3"
						aria-label="Skip back"
					>
						<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-muted)"><polygon points="11,19 2,12 11,5"/><polygon points="22,19 13,12 22,5"/></svg>
					</button>
					<button
						onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
						class="cursor-pointer bg-transparent border-none flex items-center justify-center p-3"
						aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
					>
						{#if engine.status === 'playing'}
							<svg width="40" height="40" viewBox="0 0 24 24" fill="var(--accent)"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>
						{:else}
							<svg width="40" height="40" viewBox="0 0 24 24" fill="var(--accent)"><polygon points="6,3 20,12 6,21"/></svg>
						{/if}
					</button>
					<button
						onclick={() => engine.skipForward(1)}
						class="cursor-pointer bg-transparent border-none flex items-center justify-center p-3"
						aria-label="Skip forward"
					>
						<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-muted)"><polygon points="13,19 22,12 13,5"/><polygon points="2,19 11,12 2,5"/></svg>
					</button>
					{#if engine.hasChapters}
						<button
							onclick={handleNextChapter}
							class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2"
							aria-label="Next chapter"
						>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="var(--text-muted)"><polygon points="5,5 16,12 5,19"/><rect x="18" y="5" width="3" height="14"/></svg>
						</button>
					{/if}
				</div>

				<!-- Bookmark + Horizontal joystick + WPM -->
				<div class="flex items-center gap-2 pb-4 px-3">
					<button
						onclick={(e) => { e.stopPropagation(); showBookmarks = !showBookmarks; }}
						class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2 relative"
						aria-label="Bookmarks"
					>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="{bookmarkFeedback ? 'var(--accent)' : 'none'}" stroke="var(--text-muted)" stroke-width="2">
							<path d="M6 3h12v18l-6-4-6 4V3z"/>
						</svg>
						{#if (entry?.bookmarks ?? []).length > 0}
							<span class="absolute -top-1 -right-1 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style="background-color: var(--accent); color: white;">{(entry?.bookmarks ?? []).length}</span>
						{/if}
					</button>
					<div class="flex-1 flex flex-col items-center gap-2">
						<WpmJoystick orientation="horizontal" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />
						<div class="text-sm" style="color: var(--text-muted);">
							<span class="text-lg font-bold" style="color: var(--accent);">{engine.wpm}</span> WPM
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Wide layout: transport + progress bar overlaid at bottom of word area -->
	{#if layout.isWide}
		<div class="absolute bottom-0 left-0 right-[108px] flex items-center gap-4 px-4 pb-2">
			<div class="flex gap-2 items-center">
				{#if engine.hasChapters}
					<button
						onclick={handlePrevChapter}
						class="cursor-pointer bg-transparent border-none flex items-center justify-center p-1"
						aria-label="Previous chapter"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-muted)"><rect x="3" y="5" width="3" height="14"/><polygon points="19,5 8,12 19,19"/></svg>
					</button>
				{/if}
				<button
					onclick={() => engine.skipBack(1)}
					class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2"
					aria-label="Skip back"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="var(--text-muted)"><polygon points="11,19 2,12 11,5"/><polygon points="22,19 13,12 22,5"/></svg>
				</button>
				<button
					onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
					class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2"
					aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
				>
					{#if engine.status === 'playing'}
						<svg width="30" height="30" viewBox="0 0 24 24" fill="var(--accent)"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>
					{:else}
						<svg width="30" height="30" viewBox="0 0 24 24" fill="var(--accent)"><polygon points="6,3 20,12 6,21"/></svg>
					{/if}
				</button>
				<button
					onclick={() => engine.skipForward(1)}
					class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2"
					aria-label="Skip forward"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="var(--text-muted)"><polygon points="13,19 22,12 13,5"/><polygon points="2,19 11,12 2,5"/></svg>
				</button>
				{#if engine.hasChapters}
					<button
						onclick={handleNextChapter}
						class="cursor-pointer bg-transparent border-none flex items-center justify-center p-1"
						aria-label="Next chapter"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-muted)"><polygon points="5,5 16,12 5,19"/><rect x="18" y="5" width="3" height="14"/></svg>
					</button>
				{/if}
				<button
					onclick={(e) => { e.stopPropagation(); showBookmarks = !showBookmarks; }}
					class="cursor-pointer bg-transparent border-none flex items-center justify-center p-2 relative"
					aria-label="Bookmarks"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="{bookmarkFeedback ? 'var(--accent)' : 'none'}" stroke="var(--text-muted)" stroke-width="2">
						<path d="M6 3h12v18l-6-4-6 4V3z"/>
					</svg>
					{#if (entry?.bookmarks ?? []).length > 0}
						<span class="absolute -top-1 -right-1 text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center" style="background-color: var(--accent); color: white;">{(entry?.bookmarks ?? []).length}</span>
					{/if}
				</button>
			</div>
			<div
				class="flex-1 cursor-pointer rounded-full relative"
				style="background-color: var(--border); height: 6px;"
				role="progressbar"
				aria-valuenow={progressPercent}
				onclick={handleProgressClick}
			>
				<div
					class="rounded-full transition-all duration-100 h-full"
					style="background-color: var(--accent); width: {engine.progress * 100}%;"
				></div>
				{#each sortedBookmarks as bm}
					<div class="absolute" style="left: {(bm.index / engine.tokens.length) * 100}%; top: -3px; bottom: -3px; width: 2px; background-color: var(--text); opacity: 0.5; border-radius: 1px;"></div>
				{/each}
			</div>
		</div>
	{/if}
</div>

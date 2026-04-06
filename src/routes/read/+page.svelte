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
	import type { LibraryEntry, Chapter } from '$lib/types';

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

	let progressPercent = $derived(Math.round(engine.progress * 100));

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
			charOffset: 0
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

		// Request fullscreen on mobile/touch devices
		document.documentElement.requestFullscreen?.().catch(() => {});
	});

	onDestroy(() => {
		saveProgress();
		engine.destroy();
		layout.destroy();
		if (saveInterval) clearInterval(saveInterval);
		if (pulseTimeout) clearTimeout(pulseTimeout);
		if (infoBarTimeout) clearTimeout(infoBarTimeout);
		if (rewindTapTimeout) clearTimeout(rewindTapTimeout);
		if (rewindResumeTimeout) clearTimeout(rewindResumeTimeout);
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
		document.exitFullscreen?.().catch(() => {});
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
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="h-dvh flex flex-col select-none relative"
	style="background-color: var(--bg); padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);"
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
					class="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-2 text-xs z-10"
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
					onclick={handleRewindTap}
					class="absolute z-10 cursor-pointer border-none rounded-2xl flex items-center justify-center"
					style="top: 10px; left: 10px; width: 72px; height: 72px; background-color: var(--bg-surface); border: 1px solid var(--border);"
					aria-label="Rewind to start of sentence"
				>
					<!-- Circular rewind arrow: arc from right going counter-clockwise, arrow pointing left -->
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
						<path d="M 8 4.5 A 8.5 8.5 0 1 1 4 12" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
						<polyline points="8,1 4.5,4.5 8,8" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
					</svg>
				</button>
			{/if}

			<!-- Word with ORP centering -->
			<div class="flex flex-col items-center" style="width: 100%;">
				<div style="color: var(--accent); font-size: 14px;">▼</div>
				<div class="relative" style="width: 100%;">
					<div
						class="whitespace-nowrap font-bold"
						style="font-size: var(--word-font-size, 60px); line-height: 1.4; font-family: 'Courier New', Courier, monospace; position: relative; left: 50%; transform: translateX(calc(-0.5ch - {orpParts.before.length}ch));"
					>
						<span style="color: var(--text-muted);">{orpParts.before}</span><span style="color: var(--accent);">{orpParts.focus}</span><span style="color: var(--text-muted);">{orpParts.after}</span>
					</div>
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
					class="cursor-pointer mx-3 mt-4 mb-4 rounded-full"
					style="background-color: var(--border); height: var(--progress-height, 4px);"
					role="progressbar"
					aria-valuenow={progressPercent}
					onclick={handleProgressClick}
				>
					<div
						class="rounded-full transition-all duration-100 h-full"
						style="background-color: var(--accent); width: {engine.progress * 100}%;"
					></div>
				</div>

				<!-- Transport buttons -->
				<div class="flex justify-center items-center gap-6 pb-3">
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
				</div>

				<!-- Horizontal joystick + WPM -->
				<div class="flex flex-col items-center gap-2 pb-4">
					<WpmJoystick orientation="horizontal" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />
					<div class="text-sm" style="color: var(--text-muted);">
						<span class="text-lg font-bold" style="color: var(--accent);">{engine.wpm}</span> WPM
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Wide layout: transport + progress bar overlaid at bottom of word area -->
	{#if layout.isWide}
		<div class="absolute bottom-0 left-0 right-[108px] flex items-center gap-4 px-4 pb-2">
			<div class="flex gap-3 items-center">
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
			</div>
			<div
				class="flex-1 cursor-pointer rounded-full"
				style="background-color: var(--border); height: 6px;"
				role="progressbar"
				aria-valuenow={progressPercent}
				onclick={handleProgressClick}
			>
				<div
					class="rounded-full transition-all duration-100 h-full"
					style="background-color: var(--accent); width: {engine.progress * 100}%;"
				></div>
			</div>
		</div>
	{/if}
</div>

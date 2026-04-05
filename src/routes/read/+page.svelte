<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createReaderEngine } from '$lib/engine/reader-engine.svelte';
	import { parseText } from '$lib/engine/parser';
	import { createLibraryStore } from '$lib/storage/library.svelte';
	import { createPreferencesStore } from '$lib/storage/preferences.svelte';
	import { createThemeStore } from '$lib/theme/theme.svelte';
	import { createMobileDetector } from '$lib/mobile.svelte';
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

	const mobile = createMobileDetector();

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
	});

	onDestroy(() => {
		saveProgress();
		engine.destroy();
		mobile.destroy();
		if (saveInterval) clearInterval(saveInterval);
		if (pulseTimeout) clearTimeout(pulseTimeout);
		if (infoBarTimeout) clearTimeout(infoBarTimeout);
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
	class="h-screen flex select-none relative"
	class:flex-col={!mobile.isMobile || !mobile.isLandscape}
	class:flex-row={mobile.isMobile && mobile.isLandscape}
	style="background-color: var(--bg);"
	onwheel={handleWheel}
>
	{#if !mobile.isMobile}
		<!-- Desktop: Info bar always visible -->
		<div
			class="flex justify-between items-center px-4 py-2 text-xs"
			style="color: var(--text-muted); border-bottom: 1px solid var(--border);"
		>
			<button
				onclick={exit}
				class="cursor-pointer bg-transparent border-none text-xs"
				style="color: var(--text-muted);"
			>
				&larr; Back
			</button>
			<span>{currentChapter}</span>
			<div class="flex gap-4 items-center">
				<span>{progressPercent}%</span>
				<span
					class="transition-all duration-150"
					style="font-size: {wpmPulse ? '16px' : '12px'}; font-weight: {wpmPulse ? 'bold' : 'normal'}; color: {wpmPulse ? 'var(--accent)' : 'var(--text-muted)'};"
				>
					{engine.wpm} WPM
				</span>
				<button
					onclick={() => theme.toggle()}
					class="cursor-pointer bg-transparent border-none text-xs"
					style="color: var(--text-muted);"
				>
					{theme.current === 'dark' ? '☀' : '☾'}
				</button>
			</div>
		</div>
	{/if}

	{#if storageWarning}
		<div class="px-4 py-1 text-xs text-center" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{storageWarning}
		</div>
	{/if}

	<!-- Main content area -->
	<div
		class="flex-1 flex min-h-0"
		class:flex-col={!mobile.isMobile || !mobile.isLandscape}
	>
		<!-- Word Display Area -->
		<div
			class="flex-1 flex items-center justify-center overflow-hidden relative"
			onclick={mobile.isMobile ? toggleInfoBar : undefined}
			role={mobile.isMobile ? 'button' : undefined}
			tabindex={mobile.isMobile ? 0 : undefined}
		>
			<!-- Mobile: overlay info bar -->
			{#if mobile.isMobile && showInfoBar}
				<div
					class="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-2 text-xs z-10 transition-opacity duration-200"
					style="background-color: rgba(26,26,46,0.9); color: var(--text-muted); backdrop-filter: blur(4px);"
				>
					<button
						onclick={exitStopPropagation}
						class="cursor-pointer bg-transparent border-none min-w-[44px] min-h-[44px] flex items-center justify-center text-xs"
						style="color: var(--text-muted);"
					>
						&larr; Back
					</button>
					<span class="truncate mx-2">{currentChapter}</span>
					<div class="flex gap-3 items-center">
						<span>{progressPercent}%</span>
						<span style="color: var(--accent);">{engine.wpm} WPM</span>
						<button
							onclick={toggleThemeStopPropagation}
							class="cursor-pointer bg-transparent border-none min-w-[44px] min-h-[44px] flex items-center justify-center text-xs"
							style="color: var(--text-muted);"
						>
							{theme.current === 'dark' ? '☀' : '☾'}
						</button>
					</div>
				</div>
			{/if}

			<div class="relative" style="width: 100%; height: 120px;">
				<div class="absolute left-1/2 -translate-x-1/2" style="color: var(--accent); top: 0; font-size: 14px;">
					▼
				</div>
				<div
					class="absolute whitespace-nowrap font-bold"
					style="font-size: var(--word-font-size, 60px); line-height: 1.2; font-family: 'Courier New', Courier, monospace; top: 24px; left: 50%; transform: translateX(calc(-0.5ch - {orpParts.before.length}ch));"
				>
					<span style="color: var(--text-muted);">{orpParts.before}</span><span style="color: var(--accent);">{orpParts.focus}</span><span style="color: var(--text-muted);">{orpParts.after}</span>
				</div>
				<div class="absolute left-1/2 -translate-x-1/2" style="color: var(--accent); bottom: 0; font-size: 14px;">
					▲
				</div>
			</div>
		</div>

		<!-- Controls section -->
		{#if mobile.isMobile && mobile.isLandscape}
			<!-- LANDSCAPE: Right-side control panel -->
			<div
				class="flex flex-col items-center justify-center gap-2 py-2 px-2"
				style="width: 120px; background-color: var(--bg-surface); border-left: 1px solid var(--border);"
			>
				<!-- WPM value -->
				<div class="text-center">
					<div class="text-[22px] font-bold" style="color: var(--accent);">{engine.wpm}</div>
					<div class="text-[9px] tracking-widest" style="color: var(--text-muted);">WPM</div>
				</div>

				<!-- Vertical joystick -->
				<WpmJoystick orientation="vertical" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />

				<!-- Transport buttons -->
				<div class="flex gap-[6px] items-center">
					<button
						onclick={() => engine.skipBack(1)}
						class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 text-[13px]"
						style="background-color: var(--bg); border-color: var(--border); color: var(--text-muted);"
						aria-label="Skip back"
					>⏮</button>
					<button
						onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
						class="w-[42px] h-[42px] rounded-full flex items-center justify-center cursor-pointer border-none text-[17px]"
						style="background-color: var(--accent); color: white;"
						aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
					>{engine.status === 'playing' ? '⏸' : '▶'}</button>
					<button
						onclick={() => engine.skipForward(1)}
						class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 text-[13px]"
						style="background-color: var(--bg); border-color: var(--border); color: var(--text-muted);"
						aria-label="Skip forward"
					>⏭</button>
				</div>
			</div>
		{:else}
			<!-- PORTRAIT + DESKTOP: Controls below -->
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

				{#if mobile.isMobile}
					<!-- Mobile portrait: bigger circular buttons -->
					<div class="flex justify-center items-center gap-4 pb-3">
						<button
							onclick={() => engine.skipBack(1)}
							class="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 text-base"
							style="background-color: var(--bg-surface); border-color: var(--border); color: var(--text-muted);"
							aria-label="Skip back"
						>⏮</button>
						<button
							onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
							class="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer border-none text-xl"
							style="background-color: var(--accent); color: white;"
							aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
						>{engine.status === 'playing' ? '⏸' : '▶'}</button>
						<button
							onclick={() => engine.skipForward(1)}
							class="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 text-base"
							style="background-color: var(--bg-surface); border-color: var(--border); color: var(--text-muted);"
							aria-label="Skip forward"
						>⏭</button>
					</div>

					<!-- Horizontal joystick + WPM -->
					<div class="flex flex-col items-center gap-2 pb-4">
						<WpmJoystick orientation="horizontal" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />
						<div class="text-sm" style="color: var(--text-muted);">
							<span class="text-lg font-bold" style="color: var(--accent);">{engine.wpm}</span> WPM
						</div>
					</div>
				{:else}
					<!-- Desktop: original controls -->
					<div class="flex justify-center items-center gap-6 pb-6">
						<button
							onclick={() => engine.skipBack(1)}
							class="text-2xl cursor-pointer bg-transparent border-none"
							style="color: var(--text-muted);"
							aria-label="Skip back"
						>⏮</button>
						<button
							onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
							class="text-4xl cursor-pointer bg-transparent border-none"
							style="color: var(--accent);"
							aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
						>{engine.status === 'playing' ? '⏸' : '▶'}</button>
						<button
							onclick={() => engine.skipForward(1)}
							class="text-2xl cursor-pointer bg-transparent border-none"
							style="color: var(--text-muted);"
							aria-label="Skip forward"
						>⏭</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Landscape: progress bar at bottom of word area -->
	{#if mobile.isMobile && mobile.isLandscape}
		<div
			class="absolute bottom-2 left-4 right-[128px] cursor-pointer rounded-full"
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
	{/if}
</div>

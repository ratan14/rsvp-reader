<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createReaderEngine } from '$lib/engine/reader-engine.svelte';
	import { parseText } from '$lib/engine/parser';
	import { createLibraryStore } from '$lib/storage/library.svelte';
	import { createPreferencesStore } from '$lib/storage/preferences.svelte';
	import { createThemeStore } from '$lib/theme/theme.svelte';
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
		if (saveInterval) clearInterval(saveInterval);
		if (pulseTimeout) clearTimeout(pulseTimeout);
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
				engine.skipBack(5);
				break;
			case 'ArrowRight':
				engine.skipForward(5);
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
				engine.seekTo(0);
				break;
			case 'End':
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
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="h-screen flex flex-col select-none"
	style="background-color: var(--bg);"
	onwheel={handleWheel}
>
	<!-- Info Bar -->
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

	{#if storageWarning}
		<div class="px-4 py-1 text-xs text-center" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{storageWarning}
		</div>
	{/if}

	<!-- Word Display -->
	<div class="flex-1 flex items-center justify-center">
		<div class="text-center">
			<!-- ORP Guide (top) -->
			<div class="text-xs mb-1" style="color: var(--border); letter-spacing: {orpParts.before.length * 0.6}em;">
				|
			</div>

			<!-- Word with ORP highlight -->
			<div class="font-bold" style="font-size: 60px; line-height: 1.2;">
				<span style="color: var(--text-muted);">{orpParts.before}</span><span style="color: var(--accent);">{orpParts.focus}</span><span style="color: var(--text-muted);">{orpParts.after}</span>
			</div>

			<!-- ORP Guide (bottom) -->
			<div class="text-xs mt-1" style="color: var(--border); letter-spacing: {orpParts.before.length * 0.6}em;">
				|
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="px-6 pb-6" style="border-top: 1px solid var(--border);">
		<!-- Progress Bar -->
		<div
			class="h-1 rounded-full mt-4 mb-4 cursor-pointer"
			style="background-color: var(--border);"
			role="progressbar"
			aria-valuenow={progressPercent}
			onclick={handleProgressClick}
		>
			<div
				class="h-1 rounded-full transition-all duration-100"
				style="background-color: var(--accent); width: {engine.progress * 100}%;"
			></div>
		</div>

		<!-- Transport Controls -->
		<div class="flex justify-center items-center gap-6">
			<button
				onclick={() => engine.skipBack(5)}
				class="text-2xl cursor-pointer bg-transparent border-none"
				style="color: var(--text-muted);"
				aria-label="Skip back"
			>⏮</button>

			<button
				onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
				class="text-4xl cursor-pointer bg-transparent border-none"
				style="color: var(--accent);"
				aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
			>
				{engine.status === 'playing' ? '⏸' : '▶'}
			</button>

			<button
				onclick={() => engine.skipForward(5)}
				class="text-2xl cursor-pointer bg-transparent border-none"
				style="color: var(--text-muted);"
				aria-label="Skip forward"
			>⏭</button>
		</div>
	</div>
</div>

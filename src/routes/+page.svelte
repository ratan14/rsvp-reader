<script lang="ts">
	import { goto } from '$app/navigation';
	import { importTextFile } from '$lib/importers/text-importer';
	import { importPastedText } from '$lib/importers/paste-importer';
	import { importEpub } from '$lib/importers/epub-importer';
	import { importUrl } from '$lib/importers/url-importer';
	import { parseText } from '$lib/engine/parser';
	import { createLibraryStore } from '$lib/storage/library.svelte';
	import { createPreferencesStore } from '$lib/storage/preferences.svelte';
	import type { ContentResult } from '$lib/types';

	const library = createLibraryStore();
	const preferences = createPreferencesStore();

	let pasteText = $state('');
	let urlInput = $state('');
	let error = $state('');
	let loading = $state(false);
	let dragOver = $state(false);

	let recentEntries = $derived(
		[...library.entries].sort((a, b) => b.lastRead - a.lastRead).slice(0, 3)
	);

	function sourceIcon(source: string): string {
		switch (source) {
			case 'file': return '📄';
			case 'paste': return '📋';
			case 'url': return '🔗';
			default: return '📄';
		}
	}

	async function handleContent(content: ContentResult, sourceRef: string) {
		const tokens = parseText(content.text, content.chapters);
		if (tokens.length === 0) {
			error = 'No readable text found';
			return;
		}

		const id = btoa(encodeURIComponent(content.title + content.source)).slice(0, 32);
		const existing = library.getById(id);

		library.save({
			id,
			title: content.title,
			source: content.source,
			sourceRef,
			currentIndex: existing?.currentIndex ?? 0,
			totalWords: tokens.length,
			chapters: content.chapters?.map((ch) => {
				const ratio = content.text.length > 0 ? ch.charOffset / content.text.length : 0;
				const wordOffset = Math.round(ratio * tokens.length);
				return { title: ch.title, wordOffset };
			}),
			bookmarks: existing?.bookmarks,
			lastRead: Date.now(),
			wpm: existing?.wpm ?? preferences.preferences.defaultWpm,
			cachedText: content.text
		});

		goto(`/read?id=${encodeURIComponent(id)}`);
	}

	async function handleFile(file: File) {
		error = '';
		loading = true;
		try {
			if (file.name.endsWith('.txt')) {
				const text = await file.text();
				const content = importTextFile(text, file.name);
				await handleContent(content, file.name);
			} else if (file.name.endsWith('.epub')) {
				const buf = await file.arrayBuffer();
				const content = await importEpub(buf, file.name);
				await handleContent(content, file.name);
			} else {
				error = 'Unsupported file type. Please use .txt or .epub files.';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't read this file";
		} finally {
			loading = false;
		}
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	async function handlePaste() {
		error = '';
		if (!pasteText.trim()) {
			error = 'Please paste some text first';
			return;
		}
		const content = importPastedText(pasteText);
		await handleContent(content, 'pasted');
	}

	async function handleUrl() {
		error = '';
		if (!urlInput.trim()) {
			error = 'Please enter a URL';
			return;
		}
		loading = true;
		try {
			const content = await importUrl(urlInput);
			await handleContent(content, urlInput);
		} catch (e) {
			error = e instanceof Error
				? e.message
				: 'Failed to fetch URL. Try pasting the text directly instead.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto p-8">
	<div class="text-center mb-12">
		<img src="/favicon.svg" alt="Flowvea" class="w-16 h-16 mx-auto mb-4" />
		<h1 class="text-3xl font-bold mb-2" style="color: var(--text);">Flowvea</h1>
		<p style="color: var(--text-muted);">Speed read any text, one word at a time</p>
	</div>

	{#if error}
		<div class="mb-6 p-3 rounded text-sm" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{error}
		</div>
	{/if}

	<!-- File Upload -->
	<section class="mb-8">
		<h2 class="text-sm font-semibold uppercase tracking-wide mb-3" style="color: var(--text-muted);">Upload File</h2>
		<div
			class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
			style="border-color: {dragOver ? 'var(--accent)' : 'var(--border)'}; background-color: {dragOver ? 'rgba(255,107,107,0.05)' : 'transparent'};"
			role="button"
			tabindex="0"
			ondrop={onDrop}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
			onclick={() => document.getElementById('file-input')?.click()}
			onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('file-input')?.click(); }}
		>
			<p style="color: var(--text-muted);">Drop a .txt or .epub file here, or click to browse</p>
			<input id="file-input" type="file" accept=".txt,.epub" class="hidden" onchange={onFileInput} />
		</div>
	</section>

	<!-- Paste Text -->
	<section class="mb-8">
		<h2 class="text-sm font-semibold uppercase tracking-wide mb-3" style="color: var(--text-muted);">Paste Text</h2>
		<textarea
			bind:value={pasteText}
			placeholder="Paste your text here..."
			rows="4"
			class="w-full p-3 rounded-lg border text-sm resize-y"
			style="background-color: var(--bg-surface); color: var(--text); border-color: var(--border);"
		></textarea>
		<button
			onclick={handlePaste}
			class="mt-2 px-4 py-2 rounded text-sm font-medium cursor-pointer"
			style="background-color: var(--accent); color: white;"
		>
			Start Reading
		</button>
	</section>

	<!-- URL Input -->
	<section class="mb-8">
		<h2 class="text-sm font-semibold uppercase tracking-wide mb-3" style="color: var(--text-muted);">From URL</h2>
		<div class="flex gap-2">
			<input
				bind:value={urlInput}
				type="url"
				placeholder="https://example.com/article"
				class="flex-1 p-3 rounded-lg border text-sm"
				style="background-color: var(--bg-surface); color: var(--text); border-color: var(--border);"
				onkeydown={(e) => { if (e.key === 'Enter') handleUrl(); }}
			/>
			<button
				onclick={handleUrl}
				disabled={loading}
				class="px-4 py-2 rounded text-sm font-medium cursor-pointer"
				style="background-color: var(--accent); color: white; opacity: {loading ? 0.6 : 1};"
			>
				{loading ? 'Fetching...' : 'Fetch'}
			</button>
		</div>
	</section>

	<!-- Recent from Library -->
	{#if recentEntries.length > 0}
		<section class="mb-8">
			<div class="flex justify-between items-center mb-3">
				<h2 class="text-sm font-semibold uppercase tracking-wide" style="color: var(--text-muted);">Continue Reading</h2>
				<a href="/library" class="text-xs" style="color: var(--accent);">View all</a>
			</div>
			<div class="flex flex-col gap-2">
				{#each recentEntries as entry (entry.id)}
					<a
						href="/read?id={encodeURIComponent(entry.id)}"
						class="p-3 rounded-lg border flex items-center gap-3 no-underline transition-colors"
						style="background-color: var(--bg-surface); border-color: var(--border);"
					>
						<span class="text-lg">{sourceIcon(entry.source)}</span>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium truncate" style="color: var(--text);">{entry.title}</div>
							<div class="text-xs" style="color: var(--text-muted);">
								{Math.round((entry.currentIndex / entry.totalWords) * 100)}% · {entry.totalWords} words
							</div>
						</div>
						<div class="text-xs font-medium" style="color: var(--accent);">Resume</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>

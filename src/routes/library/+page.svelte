<script lang="ts">
	import { goto } from '$app/navigation';
	import { createLibraryStore } from '$lib/storage/library.svelte';

	const library = createLibraryStore();

	let sortedEntries = $derived(
		[...library.entries].sort((a, b) => b.lastRead - a.lastRead)
	);

	function resume(id: string) {
		goto(`/read?id=${encodeURIComponent(id)}`);
	}

	function remove(e: Event, id: string) {
		e.stopPropagation();
		library.remove(id);
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function sourceIcon(source: string): string {
		switch (source) {
			case 'file': return '📄';
			case 'paste': return '📋';
			case 'url': return '🔗';
			default: return '📄';
		}
	}
</script>

<div class="max-w-2xl mx-auto p-8">
	<h1 class="text-2xl font-bold mb-6" style="color: var(--text);">Library</h1>

	{#if sortedEntries.length === 0}
		<div class="text-center py-16">
			<p style="color: var(--text-muted);">No reading history yet.</p>
			<a href="/" class="text-sm mt-2 inline-block" style="color: var(--accent);">Import something to read</a>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each sortedEntries as entry (entry.id)}
				<div
					onclick={() => resume(entry.id)}
					onkeydown={(e) => { if (e.key === 'Enter') resume(entry.id); }}
					role="button"
					tabindex="0"
					class="w-full text-left p-4 rounded-lg border cursor-pointer flex items-center gap-4 transition-colors"
					style="background-color: var(--bg-surface); border-color: var(--border);"
				>
					<span class="text-xl">{sourceIcon(entry.source)}</span>
					<div class="flex-1 min-w-0">
						<div class="font-medium truncate" style="color: var(--text);">{entry.title}</div>
						<div class="text-xs mt-1 flex gap-3" style="color: var(--text-muted);">
							<span>{Math.round((entry.currentIndex / entry.totalWords) * 100)}% complete</span>
							<span>{entry.totalWords} words</span>
							<span>{formatDate(entry.lastRead)}</span>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-10 h-10 relative">
							<svg viewBox="0 0 36 36" class="w-10 h-10">
								<path
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
									fill="none"
									stroke="var(--border)"
									stroke-width="3"
								/>
								<path
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
									fill="none"
									stroke="var(--accent)"
									stroke-width="3"
									stroke-dasharray="{Math.round((entry.currentIndex / entry.totalWords) * 100)}, 100"
								/>
							</svg>
						</div>
						<button
							onclick={(e) => remove(e, entry.id)}
							class="text-sm cursor-pointer bg-transparent border-none px-2"
							style="color: var(--text-muted);"
							aria-label="Remove from library"
						>✕</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

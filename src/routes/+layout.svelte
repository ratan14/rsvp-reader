<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	let { children } = $props();

	let isReaderPage = $derived($page.url.pathname === '/read');
</script>

{#if !isReaderPage}
	<nav class="flex items-center justify-between px-6 py-3 border-b" style="background-color: var(--bg-surface); border-color: var(--border);">
		<a href="/" class="text-lg font-bold no-underline" style="color: var(--text);">RSVP Reader</a>
		<div class="flex gap-4">
			<a href="/" class="no-underline text-sm" style="color: var(--text-muted);">Home</a>
			<a href="/library" class="no-underline text-sm" style="color: var(--text-muted);">Library</a>
		</div>
	</nav>
{/if}

{@render children()}

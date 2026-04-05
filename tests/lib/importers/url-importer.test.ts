// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importUrl, extractArticle } from '$lib/importers/url-importer';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('extractArticle', () => {
	it('extracts title and text from HTML', () => {
		const html = `
			<html><head><title>My Article</title></head>
			<body>
				<nav>Site Nav</nav>
				<article>
					<h1>My Article</h1>
					<p>This is the first paragraph of a reasonably long article that should be picked up by readability.</p>
					<p>This is a second paragraph with enough content to make readability consider this the main content of the page.</p>
					<p>And a third paragraph to ensure we have enough text content for the algorithm to work with properly here.</p>
				</article>
				<footer>Footer stuff</footer>
			</body></html>
		`;
		const result = extractArticle(html, 'https://example.com/article');
		expect(result).not.toBeNull();
		expect(result!.title).toBe('My Article');
		expect(result!.text).toContain('first paragraph');
	});
});

describe('importUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('fetches URL through CORS proxy and extracts article', async () => {
		const html = `
			<html><head><title>Test Article</title></head>
			<body><article>
				<h1>Test Article</h1>
				<p>A full article paragraph with substantial content that readability will parse correctly as main content.</p>
				<p>Another paragraph with additional content to ensure readability treats this as an article.</p>
				<p>Third paragraph providing more context and substance for the readability algorithm to work with.</p>
			</article></body></html>
		`;
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () => Promise.resolve(html)
		});

		const result = await importUrl('https://example.com/article');
		expect(result.source).toBe('url');
		expect(result.title).toBe('Test Article');
		expect(result.text).toContain('full article paragraph');
	});

	it('throws on fetch failure', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
		await expect(importUrl('https://example.com/404')).rejects.toThrow();
	});

	it('throws when readability cannot extract content', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () => Promise.resolve('<html><body></body></html>')
		});
		await expect(importUrl('https://example.com/empty')).rejects.toThrow();
	});
});

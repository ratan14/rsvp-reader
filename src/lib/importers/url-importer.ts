import { Readability } from '@mozilla/readability';
import type { ContentResult } from '$lib/types';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Extract article content from HTML using Readability.js.
 * Returns null if extraction fails.
 */
export function extractArticle(
	html: string,
	url: string
): { title: string; text: string } | null {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const reader = new Readability(doc, { charThreshold: 50 });
	const article = reader.parse();
	if (!article || !article.textContent?.trim()) return null;
	return {
		title: article.title || new URL(url).hostname,
		text: article.textContent.trim()
	};
}

export async function importUrl(url: string): Promise<ContentResult> {
	const proxyUrl = CORS_PROXY + encodeURIComponent(url);
	const response = await fetch(proxyUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch URL (${response.status})`);
	}

	const html = await response.text();
	const article = extractArticle(html, url);
	if (!article) {
		throw new Error(
			'Could not extract article content. Try pasting the text directly instead.'
		);
	}

	return {
		title: article.title,
		text: article.text,
		source: 'url'
	};
}

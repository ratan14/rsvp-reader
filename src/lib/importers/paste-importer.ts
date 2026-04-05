import type { ContentResult } from '$lib/types';

export function importPastedText(text: string): ContentResult {
	const firstLine = text.split('\n')[0].trim();
	const title = firstLine || 'Pasted text';

	return {
		title,
		text,
		source: 'paste'
	};
}

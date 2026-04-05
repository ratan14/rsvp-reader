import type { ContentResult } from '$lib/types';

export function importTextFile(text: string, filename: string): ContentResult {
	const title = filename.replace(/\.txt$/i, '');
	return {
		title,
		text,
		source: 'file'
	};
}

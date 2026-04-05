import JSZip from 'jszip';
import type { ContentResult, Chapter } from '$lib/types';

/**
 * Extract plain text from HTML/XHTML string.
 * Uses DOMParser in browser; falls back to regex stripping.
 */
export function extractTextFromHtml(html: string): string {
	if (!html) return '';
	if (typeof DOMParser !== 'undefined') {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body?.textContent?.trim() ?? '';
	}
	// Fallback: strip tags with regex (for environments without DOM)
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseXml(xmlString: string): Document {
	if (typeof DOMParser !== 'undefined') {
		return new DOMParser().parseFromString(xmlString, 'application/xml');
	}
	throw new Error('DOMParser not available');
}

function getTextContent(el: Element | null): string {
	return el?.textContent?.trim() ?? '';
}

export async function importEpub(data: ArrayBuffer, filename: string): Promise<ContentResult> {
	const zip = await JSZip.loadAsync(data);

	// 1. Find OPF path from container.xml
	const containerXml = await zip.file('META-INF/container.xml')?.async('string');
	if (!containerXml) throw new Error("Couldn't read this file");

	const containerDoc = parseXml(containerXml);
	const rootfilePath =
		containerDoc.querySelector('rootfile')?.getAttribute('full-path') ?? '';
	if (!rootfilePath) throw new Error("Couldn't read this file");

	// 2. Parse OPF for metadata, manifest, spine
	const opfXml = await zip.file(rootfilePath)?.async('string');
	if (!opfXml) throw new Error("Couldn't read this file");

	const opfDoc = parseXml(opfXml);
	const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

	// Title
	const titleEl = opfDoc.querySelector('metadata *|title') ?? opfDoc.querySelector('dc\\:title');
	const title = getTextContent(titleEl) || filename.replace(/\.epub$/i, '');

	// Manifest: id → href mapping
	const manifest = new Map<string, string>();
	opfDoc.querySelectorAll('manifest item').forEach((item) => {
		const id = item.getAttribute('id');
		const href = item.getAttribute('href');
		if (id && href) manifest.set(id, href);
	});

	// Spine: ordered list of content item IDs
	const spineRefs: string[] = [];
	opfDoc.querySelectorAll('spine itemref').forEach((ref) => {
		const idref = ref.getAttribute('idref');
		if (idref) spineRefs.push(idref);
	});

	// 3. Try to parse TOC (NCX) for chapter names
	const tocId = opfDoc.querySelector('spine')?.getAttribute('toc');
	const tocHref = tocId ? manifest.get(tocId) : undefined;
	const tocMap = new Map<string, string>(); // href → chapter title

	if (tocHref) {
		const tocXml = await zip.file(opfDir + tocHref)?.async('string');
		if (tocXml) {
			const tocDoc = parseXml(tocXml);
			tocDoc.querySelectorAll('navPoint').forEach((np) => {
				const label = np.querySelector('navLabel text')?.textContent?.trim();
				const src = np.querySelector('content')?.getAttribute('src')?.split('#')[0];
				if (label && src) tocMap.set(src, label);
			});
		}
	}

	// 4. Read spine items in order, extract text, build chapters
	const chapters: Chapter[] = [];
	let fullText = '';

	for (const idref of spineRefs) {
		const href = manifest.get(idref);
		if (!href) continue;

		const html = await zip.file(opfDir + href)?.async('string');
		if (!html) continue;

		const chapterTitle = tocMap.get(href);
		if (chapterTitle) {
			chapters.push({ title: chapterTitle, charOffset: fullText.length });
		}

		const text = extractTextFromHtml(html);
		if (text) {
			if (fullText.length > 0) fullText += '\n\n';
			fullText += text;
		}
	}

	return {
		title,
		text: fullText,
		chapters: chapters.length > 0 ? chapters : undefined,
		source: 'file'
	};
}

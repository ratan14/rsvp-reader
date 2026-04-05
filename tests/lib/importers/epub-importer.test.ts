// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { importEpub, extractTextFromHtml } from '$lib/importers/epub-importer';
import JSZip from 'jszip';

describe('extractTextFromHtml', () => {
	it('extracts text content from HTML', () => {
		const html = '<html><body><p>Hello <b>world</b></p><p>Second paragraph</p></body></html>';
		const text = extractTextFromHtml(html);
		expect(text).toContain('Hello world');
		expect(text).toContain('Second paragraph');
	});

	it('returns empty string for empty HTML', () => {
		expect(extractTextFromHtml('')).toBe('');
	});
});

describe('importEpub', () => {
	async function createTestEpub(): Promise<ArrayBuffer> {
		const zip = new JSZip();

		zip.file('mimetype', 'application/epub+zip');

		zip.file(
			'META-INF/container.xml',
			`<?xml version="1.0"?>
			<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
				<rootfiles>
					<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
				</rootfiles>
			</container>`
		);

		zip.file(
			'content.opf',
			`<?xml version="1.0"?>
			<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
				<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
					<dc:title>Test Book</dc:title>
				</metadata>
				<manifest>
					<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
					<item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
					<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
				</manifest>
				<spine toc="toc">
					<itemref idref="ch1"/>
					<itemref idref="ch2"/>
				</spine>
			</package>`
		);

		zip.file(
			'toc.ncx',
			`<?xml version="1.0"?>
			<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
				<navMap>
					<navPoint id="np1">
						<navLabel><text>Chapter One</text></navLabel>
						<content src="ch1.xhtml"/>
					</navPoint>
					<navPoint id="np2">
						<navLabel><text>Chapter Two</text></navLabel>
						<content src="ch2.xhtml"/>
					</navPoint>
				</navMap>
			</ncx>`
		);

		zip.file(
			'ch1.xhtml',
			`<html><body><h1>Chapter One</h1><p>First chapter content here.</p></body></html>`
		);

		zip.file(
			'ch2.xhtml',
			`<html><body><h1>Chapter Two</h1><p>Second chapter content here.</p></body></html>`
		);

		return await zip.generateAsync({ type: 'arraybuffer' });
	}

	it('extracts title from EPUB metadata', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.title).toBe('Test Book');
	});

	it('extracts text from all spine items', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.text).toContain('First chapter content');
		expect(result.text).toContain('Second chapter content');
	});

	it('extracts chapters with char offsets', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.chapters).toBeDefined();
		expect(result.chapters!.length).toBe(2);
		expect(result.chapters![0].title).toBe('Chapter One');
		expect(result.chapters![0].charOffset).toBe(0);
		expect(result.chapters![1].title).toBe('Chapter Two');
		expect(result.chapters![1].charOffset).toBeGreaterThan(0);
	});

	it('sets source to file', async () => {
		const epub = await createTestEpub();
		const result = await importEpub(epub, 'test.epub');
		expect(result.source).toBe('file');
	});

	it('falls back to filename when no title in metadata', async () => {
		const zip = new JSZip();
		zip.file('mimetype', 'application/epub+zip');
		zip.file(
			'META-INF/container.xml',
			`<?xml version="1.0"?>
			<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
				<rootfiles>
					<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
				</rootfiles>
			</container>`
		);
		zip.file(
			'content.opf',
			`<?xml version="1.0"?>
			<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
				<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"></metadata>
				<manifest>
					<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
				</manifest>
				<spine><itemref idref="ch1"/></spine>
			</package>`
		);
		zip.file('ch1.xhtml', '<html><body><p>Content</p></body></html>');

		const buf = await zip.generateAsync({ type: 'arraybuffer' });
		const result = await importEpub(buf, 'mybook.epub');
		expect(result.title).toBe('mybook');
	});
});

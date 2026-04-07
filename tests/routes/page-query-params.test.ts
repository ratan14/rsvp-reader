// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

/**
 * We test the extraction logic that will be added to +page.svelte.
 * The actual function will be inlined in onMount, but we extract
 * the param-parsing logic into a helper for testability.
 */

function parseExtensionParams(search: string, hash: string):
  | { type: 'url'; url: string }
  | { type: 'text'; text: string }
  | null {
  const params = new URLSearchParams(search);

  const url = params.get('url');
  if (url) {
    return { type: 'url', url };
  }

  if (params.get('source') === 'text' && hash.length > 1) {
    const text = decodeURIComponent(hash.slice(1));
    if (text.trim()) {
      return { type: 'text', text };
    }
  }

  return null;
}

describe('parseExtensionParams', () => {
  it('returns url type when ?url= is present', () => {
    const result = parseExtensionParams('?url=https%3A%2F%2Fexample.com%2Farticle', '');
    expect(result).toEqual({ type: 'url', url: 'https://example.com/article' });
  });

  it('returns text type when ?source=text and hash is present', () => {
    const result = parseExtensionParams('?source=text', '#Hello%20world');
    expect(result).toEqual({ type: 'text', text: 'Hello world' });
  });

  it('returns null when no extension params are present', () => {
    const result = parseExtensionParams('', '');
    expect(result).toBeNull();
  });

  it('returns null when source=text but hash is empty', () => {
    const result = parseExtensionParams('?source=text', '');
    expect(result).toBeNull();
  });

  it('returns null when source=text but hash is only whitespace', () => {
    const result = parseExtensionParams('?source=text', '#%20%20');
    expect(result).toBeNull();
  });

  it('handles url param with special characters', () => {
    const result = parseExtensionParams(
      '?url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3Dfoo%26bar%3Dbaz',
      ''
    );
    expect(result).toEqual({ type: 'url', url: 'https://example.com/path?q=foo&bar=baz' });
  });

  it('handles large text in hash fragment', () => {
    const longText = 'word '.repeat(10000).trim();
    const encoded = encodeURIComponent(longText);
    const result = parseExtensionParams('?source=text', `#${encoded}`);
    expect(result).toEqual({ type: 'text', text: longText });
  });

  it('prefers url param over source=text', () => {
    const result = parseExtensionParams('?url=https%3A%2F%2Fexample.com&source=text', '#some%20text');
    expect(result).toEqual({ type: 'url', url: 'https://example.com' });
  });
});

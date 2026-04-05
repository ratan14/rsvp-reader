import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('createLayoutDetector', () => {
	let matchMediaMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		matchMediaMock = vi.fn().mockReturnValue({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		});
		vi.stubGlobal('matchMedia', matchMediaMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('isWide=false and isSmall=false on tall large screen', async () => {
		const { createLayoutDetector } = await import('$lib/layout.svelte');
		const layout = createLayoutDetector();
		expect(layout.isWide).toBe(false);
		expect(layout.isSmall).toBe(false);
		layout.destroy();
	});

	it('isWide=true when orientation is landscape', async () => {
		matchMediaMock.mockImplementation((query: string) => ({
			matches: query.includes('orientation: landscape'),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		const { createLayoutDetector } = await import('$lib/layout.svelte');
		const layout = createLayoutDetector();
		expect(layout.isWide).toBe(true);
		layout.destroy();
	});

	it('isSmall=true when screen is short or narrow', async () => {
		matchMediaMock.mockImplementation((query: string) => ({
			matches: query.includes('max-height: 600px'),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		const { createLayoutDetector } = await import('$lib/layout.svelte');
		const layout = createLayoutDetector();
		expect(layout.isSmall).toBe(true);
		layout.destroy();
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('isMobile', () => {
	let matchMediaMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
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

	it('returns false on desktop-sized screens', async () => {
		const { createMobileDetector } = await import('$lib/mobile.svelte');
		const detector = createMobileDetector();
		expect(detector.isMobile).toBe(false);
		expect(detector.isLandscape).toBe(false);
		detector.destroy();
	});

	it('returns true when screen matches mobile query', async () => {
		matchMediaMock.mockImplementation((query: string) => ({
			matches: query.includes('max-width: 920px'),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		const { createMobileDetector } = await import('$lib/mobile.svelte');
		const detector = createMobileDetector();
		expect(detector.isMobile).toBe(true);
		detector.destroy();
	});
});

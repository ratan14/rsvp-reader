export function createLayoutDetector() {
	// Pure aspect ratio: wider than tall = side panel, taller than wide = bottom controls.
	// No pixel breakpoints. Works at any screen size.
	const wideQuery = matchMedia('(orientation: landscape)');
	// Small screen = hide info bar by default (tap to reveal)
	const smallQuery = matchMedia('(max-height: 600px), (max-width: 640px)');

	let isWide = $state(wideQuery.matches);
	let isSmall = $state(smallQuery.matches);

	function onWideChange(e: MediaQueryListEvent) {
		isWide = e.matches;
	}
	function onSmallChange(e: MediaQueryListEvent) {
		isSmall = e.matches;
	}

	wideQuery.addEventListener('change', onWideChange);
	smallQuery.addEventListener('change', onSmallChange);

	function destroy() {
		wideQuery.removeEventListener('change', onWideChange);
		smallQuery.removeEventListener('change', onSmallChange);
	}

	return {
		get isWide() { return isWide; },
		get isSmall() { return isSmall; },
		destroy
	};
}

export type LayoutDetector = ReturnType<typeof createLayoutDetector>;

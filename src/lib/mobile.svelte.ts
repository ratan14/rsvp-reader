export function createMobileDetector() {
	const mobileQuery = matchMedia('(max-width: 920px)');
	const landscapeQuery = matchMedia('(orientation: landscape)');

	let isMobile = $state(mobileQuery.matches);
	let isLandscape = $state(landscapeQuery.matches);

	function onMobileChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}
	function onLandscapeChange(e: MediaQueryListEvent) {
		isLandscape = e.matches;
	}

	mobileQuery.addEventListener('change', onMobileChange);
	landscapeQuery.addEventListener('change', onLandscapeChange);

	function destroy() {
		mobileQuery.removeEventListener('change', onMobileChange);
		landscapeQuery.removeEventListener('change', onLandscapeChange);
	}

	return {
		get isMobile() { return isMobile; },
		get isLandscape() { return isLandscape; },
		destroy
	};
}

export type MobileDetector = ReturnType<typeof createMobileDetector>;

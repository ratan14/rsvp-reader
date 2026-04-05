# Mobile-Responsive RSVP Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the RSVP reader work well on phones with responsive layouts, a WPM rate joystick, larger touch targets, and a hidden info bar.

**Architecture:** Extract the reader page into orientation-aware layouts. A new `WpmJoystick.svelte` component handles touch-driven WPM rate control. Mobile detection uses CSS media queries scoped behind `max-width` + `orientation` breakpoints. Desktop is untouched.

**Tech Stack:** Svelte 5, SvelteKit, Tailwind CSS v4, TypeScript

---

### Task 1: Add mobile detection utility

**Files:**
- Create: `src/lib/mobile.svelte.ts`
- Test: `tests/lib/mobile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/mobile.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ratan/personal/rsvp-reader && npx vitest run tests/lib/mobile.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/lib/mobile.svelte.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ratan/personal/rsvp-reader && npx vitest run tests/lib/mobile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/ratan/personal/rsvp-reader
git add src/lib/mobile.svelte.ts tests/lib/mobile.test.ts
git commit -m "feat: add mobile/landscape detection utility"
```

---

### Task 2: Build WpmJoystick component

**Files:**
- Create: `src/lib/components/WpmJoystick.svelte`

This is a touch-interactive component that is difficult to unit test meaningfully — manual testing on a phone is the real validation. We build it here and test it visually in Task 5.

- [ ] **Step 1: Create the component**

Create `src/lib/components/WpmJoystick.svelte`:

```svelte
<script lang="ts">
	const MAX_RATE = 50; // WPM per second — tune this by feel
	const WPM_MIN = 100;
	const WPM_MAX = 1000;
	const UPDATE_INTERVAL_MS = 50; // 20fps update rate

	interface Props {
		orientation: 'horizontal' | 'vertical';
		wpm: number;
		onWpmChange: (wpm: number) => void;
	}

	let { orientation, wpm, onWpmChange }: Props = $props();

	let displacement = $state(0); // -1 to 1, where 0 is center
	let trackEl: HTMLDivElement | undefined = $state();
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function getTrackSize(): number {
		if (!trackEl) return 1;
		return orientation === 'vertical' ? trackEl.clientHeight : trackEl.clientWidth;
	}

	function getThumbSize(): number {
		return orientation === 'vertical' ? 30 : 28;
	}

	function clampDisplacement(raw: number): number {
		const maxTravel = (getTrackSize() - getThumbSize()) / 2;
		const clamped = Math.max(-maxTravel, Math.min(maxTravel, raw));
		return clamped / maxTravel; // normalize to -1..1
	}

	function startUpdating() {
		if (intervalId) return;
		let lastTime = performance.now();
		intervalId = setInterval(() => {
			const now = performance.now();
			const dt = (now - lastTime) / 1000;
			lastTime = now;
			const rate = displacement * MAX_RATE;
			const newWpm = Math.round(Math.max(WPM_MIN, Math.min(WPM_MAX, wpm + rate * dt)));
			if (newWpm !== wpm) {
				onWpmChange(newWpm);
			}
		}, UPDATE_INTERVAL_MS);
	}

	function stopUpdating() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function handleTouchStart(e: TouchEvent) {
		e.preventDefault();
		handleTouchMove(e);
		startUpdating();
	}

	function handleTouchMove(e: TouchEvent) {
		if (!trackEl || e.touches.length === 0) return;
		const touch = e.touches[0];
		const rect = trackEl.getBoundingClientRect();

		let rawPixels: number;
		if (orientation === 'vertical') {
			const center = rect.top + rect.height / 2;
			rawPixels = -(touch.clientY - center); // up is positive
		} else {
			const center = rect.left + rect.width / 2;
			rawPixels = touch.clientX - center; // right is positive
		}
		displacement = clampDisplacement(rawPixels);
	}

	function handleTouchEnd() {
		displacement = 0;
		stopUpdating();
	}

	let thumbStyle = $derived.by(() => {
		const maxTravel = (getTrackSize() - getThumbSize()) / 2;
		const px = displacement * maxTravel;
		if (orientation === 'vertical') {
			return `transform: translateX(-50%) translateY(${-px}px);`;
		}
		return `transform: translateY(-50%) translateX(${px}px);`;
	});
</script>

<div
	class="joystick-track"
	class:vertical={orientation === 'vertical'}
	class:horizontal={orientation === 'horizontal'}
	bind:this={trackEl}
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	role="slider"
	aria-label="Adjust reading speed"
	aria-valuenow={wpm}
	aria-valuemin={WPM_MIN}
	aria-valuemax={WPM_MAX}
>
	<!-- Center line -->
	<div class="joystick-center"></div>

	<!-- Rate zone hints -->
	<span class="joystick-hint joystick-hint-pos">
		{orientation === 'vertical' ? '+' : '▶'}
	</span>
	<span class="joystick-hint joystick-hint-neg">
		{orientation === 'vertical' ? '−' : '◀'}
	</span>

	<!-- Thumb -->
	<div class="joystick-thumb" style={thumbStyle}></div>
</div>

<style>
	.joystick-track {
		position: relative;
		background-color: var(--bg);
		border-radius: 13px;
		border: 1px solid var(--border);
		touch-action: none;
	}
	.joystick-track.vertical {
		width: 26px;
		height: 90px;
	}
	.joystick-track.horizontal {
		width: 120px;
		height: 24px;
	}
	.joystick-center {
		position: absolute;
		background-color: var(--border);
	}
	.vertical .joystick-center {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 18px;
		height: 2px;
	}
	.horizontal .joystick-center {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 16px;
	}
	.joystick-hint {
		position: absolute;
		font-size: 8px;
		color: var(--accent);
		user-select: none;
		pointer-events: none;
	}
	.vertical .joystick-hint-pos { top: 3px; left: 50%; transform: translateX(-50%); }
	.vertical .joystick-hint-neg { bottom: 3px; left: 50%; transform: translateX(-50%); }
	.horizontal .joystick-hint-pos { right: 4px; top: 50%; transform: translateY(-50%); }
	.horizontal .joystick-hint-neg { left: 4px; top: 50%; transform: translateY(-50%); }
	.joystick-thumb {
		position: absolute;
		background: linear-gradient(to bottom, #fff, #ddd);
		border-radius: 15px;
		box-shadow: 0 2px 6px rgba(0,0,0,0.4);
		transition: transform 0.15s ease-out;
	}
	.vertical .joystick-thumb {
		width: 36px;
		height: 30px;
		top: 50%;
		left: 50%;
		transform: translateX(-50%) translateY(-50%);
	}
	.horizontal .joystick-thumb {
		width: 30px;
		height: 28px;
		top: 50%;
		left: 50%;
		transform: translateY(-50%) translateX(-50%);
	}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /home/ratan/personal/rsvp-reader
git add src/lib/components/WpmJoystick.svelte
git commit -m "feat: add WPM rate joystick component"
```

---

### Task 3: Add responsive CSS to app.css

**Files:**
- Modify: `src/app.css`

Adds media query scoped custom properties and utility classes for mobile layouts.

- [ ] **Step 1: Add mobile CSS variables and utilities**

Append to the end of `src/app.css`:

```css
/* Mobile: portrait phone */
@media (max-width: 640px) and (orientation: portrait) {
	:root {
		--word-font-size: clamp(28px, 8vw, 48px);
		--progress-height: 6px;
	}
}

/* Mobile: landscape phone */
@media (max-width: 920px) and (orientation: landscape) {
	:root {
		--word-font-size: clamp(32px, 6vh, 44px);
		--progress-height: 6px;
	}
}

/* Desktop default */
@media (min-width: 921px) {
	:root {
		--word-font-size: 60px;
		--progress-height: 4px;
	}
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/ratan/personal/rsvp-reader
git add src/app.css
git commit -m "feat: add responsive CSS variables for mobile breakpoints"
```

---

### Task 4: Refactor reader page for mobile responsiveness

This is the main task. It modifies the reader page to:
- Use the mobile detector for layout switching
- Hide the info bar on mobile (tap to reveal)
- Rearrange controls: portrait = stacked below, landscape = right panel
- Use bigger circular buttons
- Integrate the WPM joystick

**Files:**
- Modify: `src/routes/read/+page.svelte`

- [ ] **Step 1: Add mobile detector and info bar state to the script section**

In `src/routes/read/+page.svelte`, add imports and state after the existing imports (line 10) and after `let storageWarning` (line 21):

Add to imports section:

```ts
import { createMobileDetector } from '$lib/mobile.svelte';
import WpmJoystick from '$lib/components/WpmJoystick.svelte';
```

Add after `let storageWarning = $state('');` (line 21):

```ts
let showInfoBar = $state(false);
let infoBarTimeout: ReturnType<typeof setTimeout> | null = null;

const mobile = createMobileDetector();
```

- [ ] **Step 2: Add info bar toggle and joystick WPM handler functions**

Add these functions after the existing `handleProgressClick` function (after line 163):

```ts
function toggleInfoBar() {
	if (infoBarTimeout) clearTimeout(infoBarTimeout);
	showInfoBar = !showInfoBar;
	if (showInfoBar) {
		infoBarTimeout = setTimeout(() => { showInfoBar = false; }, 3000);
	}
}

function handleJoystickWpm(newWpm: number) {
	engine.wpm = newWpm;
	wpmPulse = true;
	if (pulseTimeout) clearTimeout(pulseTimeout);
	pulseTimeout = setTimeout(() => { wpmPulse = false; }, 300);
}
```

- [ ] **Step 3: Update onDestroy to clean up mobile detector and info bar timer**

Replace the `onDestroy` block (lines 75-80) with:

```ts
onDestroy(() => {
	saveProgress();
	engine.destroy();
	mobile.destroy();
	if (saveInterval) clearInterval(saveInterval);
	if (pulseTimeout) clearTimeout(pulseTimeout);
	if (infoBarTimeout) clearTimeout(infoBarTimeout);
});
```

- [ ] **Step 4: Replace the entire template (HTML) section**

Replace everything from `<svelte:window` (line 166) to the end of the file with the new responsive template:

```svelte
<svelte:window onkeydown={handleKeydown} />

<div
	class="h-screen flex select-none relative"
	class:flex-col={!mobile.isMobile || !mobile.isLandscape}
	class:flex-row={mobile.isMobile && mobile.isLandscape}
	style="background-color: var(--bg);"
	onwheel={handleWheel}
>
	{#if !mobile.isMobile}
		<!-- Desktop: Info bar always visible -->
		<div
			class="flex justify-between items-center px-4 py-2 text-xs"
			style="color: var(--text-muted); border-bottom: 1px solid var(--border);"
		>
			<button
				onclick={exit}
				class="cursor-pointer bg-transparent border-none text-xs"
				style="color: var(--text-muted);"
			>
				&larr; Back
			</button>
			<span>{currentChapter}</span>
			<div class="flex gap-4 items-center">
				<span>{progressPercent}%</span>
				<span
					class="transition-all duration-150"
					style="font-size: {wpmPulse ? '16px' : '12px'}; font-weight: {wpmPulse ? 'bold' : 'normal'}; color: {wpmPulse ? 'var(--accent)' : 'var(--text-muted)'};"
				>
					{engine.wpm} WPM
				</span>
				<button
					onclick={() => theme.toggle()}
					class="cursor-pointer bg-transparent border-none text-xs"
					style="color: var(--text-muted);"
				>
					{theme.current === 'dark' ? '☀' : '☾'}
				</button>
			</div>
		</div>
	{/if}

	{#if storageWarning}
		<div class="px-4 py-1 text-xs text-center" style="background-color: rgba(255,107,107,0.15); color: var(--accent);">
			{storageWarning}
		</div>
	{/if}

	<!-- Main content area: word display + controls below (portrait/desktop) or side-by-side (landscape) -->
	<div
		class="flex-1 flex min-h-0"
		class:flex-col={!mobile.isMobile || !mobile.isLandscape}
	>
		<!-- Word Display Area -->
		<div
			class="flex-1 flex items-center justify-center overflow-hidden relative"
			onclick={mobile.isMobile ? toggleInfoBar : undefined}
			role={mobile.isMobile ? 'button' : undefined}
			tabindex={mobile.isMobile ? 0 : undefined}
		>
			<!-- Mobile: overlay info bar -->
			{#if mobile.isMobile && showInfoBar}
				<div
					class="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-2 text-xs z-10 transition-opacity duration-200"
					style="background-color: rgba(26,26,46,0.9); color: var(--text-muted); backdrop-filter: blur(4px);"
				>
					<button
						onclick|stopPropagation={exit}
						class="cursor-pointer bg-transparent border-none min-w-[44px] min-h-[44px] flex items-center justify-center text-xs"
						style="color: var(--text-muted);"
					>
						&larr; Back
					</button>
					<span class="truncate mx-2">{currentChapter}</span>
					<div class="flex gap-3 items-center">
						<span>{progressPercent}%</span>
						<span style="color: var(--accent);">{engine.wpm} WPM</span>
						<button
							onclick|stopPropagation={() => theme.toggle()}
							class="cursor-pointer bg-transparent border-none min-w-[44px] min-h-[44px] flex items-center justify-center text-xs"
							style="color: var(--text-muted);"
						>
							{theme.current === 'dark' ? '☀' : '☾'}
						</button>
					</div>
				</div>
			{/if}

			<div class="relative" style="width: 100%; height: 120px;">
				<div class="absolute left-1/2 -translate-x-1/2" style="color: var(--accent); top: 0; font-size: 14px;">
					▼
				</div>
				<div
					class="absolute whitespace-nowrap font-bold"
					style="font-size: var(--word-font-size, 60px); line-height: 1.2; font-family: 'Courier New', Courier, monospace; top: 24px; left: 50%; transform: translateX(calc(-0.5ch - {orpParts.before.length}ch));"
				>
					<span style="color: var(--text-muted);">{orpParts.before}</span><span style="color: var(--accent);">{orpParts.focus}</span><span style="color: var(--text-muted);">{orpParts.after}</span>
				</div>
				<div class="absolute left-1/2 -translate-x-1/2" style="color: var(--accent); bottom: 0; font-size: 14px;">
					▲
				</div>
			</div>
		</div>

		<!-- Controls section -->
		{#if mobile.isMobile && mobile.isLandscape}
			<!-- LANDSCAPE: Right-side control panel -->
			<div
				class="flex flex-col items-center justify-center gap-2 py-2 px-2"
				style="width: 120px; background-color: var(--bg-surface); border-left: 1px solid var(--border);"
			>
				<!-- WPM value -->
				<div class="text-center">
					<div class="text-[22px] font-bold" style="color: var(--accent);">{engine.wpm}</div>
					<div class="text-[9px] tracking-widest" style="color: var(--text-muted);">WPM</div>
				</div>

				<!-- Vertical joystick -->
				<WpmJoystick orientation="vertical" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />

				<!-- Transport buttons -->
				<div class="flex gap-[6px] items-center">
					<button
						onclick={() => engine.skipBack(1)}
						class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 text-[13px]"
						style="background-color: var(--bg); border-color: var(--border); color: var(--text-muted);"
						aria-label="Skip back"
					>⏮</button>
					<button
						onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
						class="w-[42px] h-[42px] rounded-full flex items-center justify-center cursor-pointer border-none text-[17px]"
						style="background-color: var(--accent); color: white;"
						aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
					>{engine.status === 'playing' ? '⏸' : '▶'}</button>
					<button
						onclick={() => engine.skipForward(1)}
						class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 text-[13px]"
						style="background-color: var(--bg); border-color: var(--border); color: var(--text-muted);"
						aria-label="Skip forward"
					>⏭</button>
				</div>
			</div>
		{:else}
			<!-- PORTRAIT + DESKTOP: Controls below -->
			<div style="border-top: 1px solid var(--border);">
				<!-- Progress Bar -->
				<div
					class="cursor-pointer mx-3 mt-4 mb-4 rounded-full"
					style="background-color: var(--border); height: var(--progress-height, 4px);"
					role="progressbar"
					aria-valuenow={progressPercent}
					onclick={handleProgressClick}
				>
					<div
						class="rounded-full transition-all duration-100 h-full"
						style="background-color: var(--accent); width: {engine.progress * 100}%;"
					></div>
				</div>

				{#if mobile.isMobile}
					<!-- Mobile portrait: bigger circular buttons -->
					<div class="flex justify-center items-center gap-4 pb-3">
						<button
							onclick={() => engine.skipBack(1)}
							class="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 text-base"
							style="background-color: var(--bg-surface); border-color: var(--border); color: var(--text-muted);"
							aria-label="Skip back"
						>⏮</button>
						<button
							onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
							class="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer border-none text-xl"
							style="background-color: var(--accent); color: white;"
							aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
						>{engine.status === 'playing' ? '⏸' : '▶'}</button>
						<button
							onclick={() => engine.skipForward(1)}
							class="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 text-base"
							style="background-color: var(--bg-surface); border-color: var(--border); color: var(--text-muted);"
							aria-label="Skip forward"
						>⏭</button>
					</div>

					<!-- Horizontal joystick + WPM -->
					<div class="flex flex-col items-center gap-2 pb-4">
						<WpmJoystick orientation="horizontal" wpm={engine.wpm} onWpmChange={handleJoystickWpm} />
						<div class="text-sm" style="color: var(--text-muted);">
							<span class="text-lg font-bold" style="color: var(--accent);">{engine.wpm}</span> WPM
						</div>
					</div>
				{:else}
					<!-- Desktop: original controls -->
					<div class="flex justify-center items-center gap-6 pb-6">
						<button
							onclick={() => engine.skipBack(1)}
							class="text-2xl cursor-pointer bg-transparent border-none"
							style="color: var(--text-muted);"
							aria-label="Skip back"
						>⏮</button>
						<button
							onclick={() => engine.status === 'playing' ? engine.pause() : engine.play()}
							class="text-4xl cursor-pointer bg-transparent border-none"
							style="color: var(--accent);"
							aria-label={engine.status === 'playing' ? 'Pause' : 'Play'}
						>{engine.status === 'playing' ? '⏸' : '▶'}</button>
						<button
							onclick={() => engine.skipForward(1)}
							class="text-2xl cursor-pointer bg-transparent border-none"
							style="color: var(--text-muted);"
							aria-label="Skip forward"
						>⏭</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Landscape: progress bar below word area, inside left column -->
	{#if mobile.isMobile && mobile.isLandscape}
		<div
			class="absolute bottom-2 left-4 right-[128px] cursor-pointer rounded-full"
			style="background-color: var(--border); height: 6px;"
			role="progressbar"
			aria-valuenow={progressPercent}
			onclick={handleProgressClick}
		>
			<div
				class="rounded-full transition-all duration-100 h-full"
				style="background-color: var(--accent); width: {engine.progress * 100}%;"
			></div>
		</div>
	{/if}
</div>
```

- [ ] **Step 5: Verify the dev server runs without errors**

Run: `cd /home/ratan/personal/rsvp-reader && npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 6: Run existing tests to confirm no regressions**

Run: `cd /home/ratan/personal/rsvp-reader && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
cd /home/ratan/personal/rsvp-reader
git add src/routes/read/+page.svelte
git commit -m "feat: make reader page responsive with mobile layouts and joystick"
```

---

### Task 5: Manual testing and polish

**Files:**
- Possibly modify: `src/routes/read/+page.svelte`, `src/lib/components/WpmJoystick.svelte`

- [ ] **Step 1: Start dev server**

Run: `cd /home/ratan/personal/rsvp-reader && npx vite dev --host`

- [ ] **Step 2: Test on phone or mobile simulator**

Open the dev server URL on a phone (or use Chrome DevTools device toolbar). Verify:
1. Portrait: controls below, horizontal joystick, big buttons, hidden info bar
2. Landscape: right-side panel with vertical joystick, transport buttons fit
3. Tap word area to reveal/hide info bar
4. Joystick changes WPM smoothly
5. Desktop: unchanged from before

- [ ] **Step 3: Fix any issues found during testing**

Address any visual overflow, touch target, or joystick feel issues.

- [ ] **Step 4: Commit any fixes**

```bash
cd /home/ratan/personal/rsvp-reader
git add -u
git commit -m "fix: polish mobile layout after manual testing"
```

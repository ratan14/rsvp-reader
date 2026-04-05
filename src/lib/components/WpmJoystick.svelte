<script lang="ts">
	const MAX_RATE = 50; // WPM per second at full displacement
	const WPM_MIN = 100;
	const WPM_MAX = 1000;
	const UPDATE_INTERVAL_MS = 50; // 20fps update rate
	const FADE_DELAY_MS = 1000;

	interface Props {
		orientation: 'horizontal' | 'vertical';
		wpm: number;
		onWpmChange: (wpm: number) => void;
	}

	let { orientation, wpm, onWpmChange }: Props = $props();

	let displacement = $state(0); // -1 to 1, where 0 is center
	let trackEl: HTMLDivElement | undefined = $state();
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let active = $state(false); // true while touching
	let showWpm = $state(false); // true while active + fade delay after release
	let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
		active = true;
		showWpm = true;
		if (fadeTimeoutId) { clearTimeout(fadeTimeoutId); fadeTimeoutId = null; }
		let lastTime = performance.now();
		let fractionalWpm = wpm;
		intervalId = setInterval(() => {
			const now = performance.now();
			const dt = (now - lastTime) / 1000;
			lastTime = now;
			// Power 1.5 curve: responsive at small displacements, fast at full
			const sign = displacement >= 0 ? 1 : -1;
			const rate = sign * Math.pow(Math.abs(displacement), 1.5) * MAX_RATE;
			fractionalWpm = Math.max(WPM_MIN, Math.min(WPM_MAX, fractionalWpm + rate * dt));
			const rounded = Math.round(fractionalWpm);
			if (rounded !== wpm) {
				onWpmChange(rounded);
			}
		}, UPDATE_INTERVAL_MS);
	}

	function stopUpdating() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		active = false;
		fadeTimeoutId = setTimeout(() => { showWpm = false; }, FADE_DELAY_MS);
	}

	function updateDisplacement(clientX: number, clientY: number) {
		if (!trackEl) return;
		const rect = trackEl.getBoundingClientRect();
		let rawPixels: number;
		if (orientation === 'vertical') {
			const center = rect.top + rect.height / 2;
			rawPixels = -(clientY - center);
		} else {
			const center = rect.left + rect.width / 2;
			rawPixels = clientX - center;
		}
		displacement = clampDisplacement(rawPixels);
	}

	function handleTouchStart(e: TouchEvent) {
		e.preventDefault();
		updateDisplacement(e.touches[0].clientX, e.touches[0].clientY);
		startUpdating();
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length === 0) return;
		updateDisplacement(e.touches[0].clientX, e.touches[0].clientY);
	}

	function handleTouchEnd() {
		displacement = 0;
		stopUpdating();
	}

	function handleMouseDown(e: MouseEvent) {
		e.preventDefault();
		updateDisplacement(e.clientX, e.clientY);
		startUpdating();
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		updateDisplacement(e.clientX, e.clientY);
	}

	function handleMouseUp() {
		displacement = 0;
		stopUpdating();
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	let thumbStyle = $derived.by(() => {
		const maxTravel = (getTrackSize() - getThumbSize()) / 2;
		const px = displacement * maxTravel;
		if (orientation === 'vertical') {
			return `transform: translateX(-50%) translateY(calc(-50% + ${-px}px));`;
		}
		return `transform: translateY(-50%) translateX(calc(-50% + ${px}px));`;
	});
</script>

<div class="joystick-wrapper" class:vertical={orientation === 'vertical'} class:horizontal={orientation === 'horizontal'}>
	<!-- Floating WPM indicator -->
	{#if showWpm}
		<div
			class="wpm-float"
			class:fading={!active}
		>
			<span class="wpm-value">{wpm}</span>
			<span class="wpm-label">WPM</span>
		</div>
	{/if}

	<div
		class="joystick-track"
		class:vertical={orientation === 'vertical'}
		class:horizontal={orientation === 'horizontal'}
		bind:this={trackEl}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		onmousedown={handleMouseDown}
		role="slider"
		aria-label="Adjust reading speed"
		aria-valuenow={wpm}
		aria-valuemin={WPM_MIN}
		aria-valuemax={WPM_MAX}
	>
		<div class="joystick-center"></div>
		<span class="joystick-hint joystick-hint-pos">
			{orientation === 'vertical' ? '+' : '▶'}
		</span>
		<span class="joystick-hint joystick-hint-neg">
			{orientation === 'vertical' ? '−' : '◀'}
		</span>
		<div class="joystick-thumb" style={thumbStyle}></div>
	</div>
</div>

<style>
	.joystick-wrapper {
		position: relative;
		overflow: visible;
	}

	/* Floating WPM display */
	.wpm-float {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
		opacity: 1;
		transition: opacity 0.5s ease-out;
		z-index: 10;
	}
	.wpm-float.fading {
		opacity: 0;
	}
	/* Vertical: float to the left, clearing the panel boundary */
	.vertical > .wpm-float {
		right: calc(100% + 40px);
		top: 50%;
		transform: translateY(-50%);
		white-space: nowrap;
	}
	/* Horizontal: float above the track */
	.horizontal > .wpm-float {
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		flex-direction: row;
		gap: 4px;
	}
	.wpm-value {
		font-size: 28px;
		font-weight: bold;
		color: var(--accent);
		font-family: system-ui, sans-serif;
		line-height: 1;
	}
	.wpm-label {
		font-size: 10px;
		color: var(--text-muted);
		letter-spacing: 1px;
	}

	/* Track */
	.joystick-track {
		position: relative;
		background-color: var(--bg);
		border-radius: 13px;
		border: 1px solid var(--border);
		touch-action: none;
	}
	.joystick-track.vertical {
		width: 36px;
		height: 140px;
	}
	.joystick-track.horizontal {
		width: 180px;
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

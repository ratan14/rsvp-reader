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
			return `transform: translateX(-50%) translateY(calc(-50% + ${-px}px));`;
		}
		return `transform: translateY(-50%) translateX(calc(-50% + ${px}px));`;
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

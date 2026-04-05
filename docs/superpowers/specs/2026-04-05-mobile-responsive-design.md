# Mobile-Responsive RSVP Reader Design

## Overview

Make the RSVP reader look good and work well on phones. The reader currently has no responsive CSS, small emoji-only buttons, and a layout that assumes a desktop viewport. This spec covers responsive layout for portrait and landscape orientations, a rate-of-change joystick for WPM control, larger touch targets, and a hidden info bar for a clean reading experience.

## Current State

- Svelte 5 + SvelteKit + Tailwind CSS v4
- No `@media` queries or responsive breakpoints
- Reader page: info bar at top, 60px word display, 4px progress bar, small emoji transport buttons at bottom
- WPM controlled via keyboard arrows and mouse wheel only
- Viewport meta tag present (`width=device-width, initial-scale=1`)

## Design

### Responsive Breakpoints

Use a single breakpoint to distinguish phone from desktop:
- **Portrait phone**: `max-width: 640px` and `orientation: portrait`
- **Landscape phone**: `max-width: 920px` and `orientation: landscape`
- **Desktop**: everything above — existing layout preserved, no changes

Use Tailwind's responsive prefixes (`sm:`, `md:`, `landscape:`) where possible. Use `@media` queries for orientation-specific layouts.

### Portrait Mode (Phone Vertical)

Layout (top to bottom):
1. **Info bar**: Hidden by default. Tap anywhere on the word display area to reveal as a semi-transparent overlay. Tap again or auto-hide after 3 seconds.
2. **Word display**: Centered, takes up the majority of screen. Font size scales down from 60px to fit viewport (use `clamp()` or viewport units). ORP guides (▼/▲) remain.
3. **Progress bar**: 6px height (up from 4px), rounded ends, full width with 12px side margins. Tap-to-seek still works.
4. **Transport buttons**: Centered row of circular buttons. Skip buttons: 48px diameter. Play/pause: 56px diameter, accent-colored background. Minimum 48px tap targets.
5. **Horizontal WPM joystick**: Below transport. Track is ~120px wide, 24px tall, rounded. Thumb handle is 30x28px. Swipe right = WPM increases, swipe left = WPM decreases. Center = neutral (no change).
6. **WPM value**: Displayed below joystick as `350 WPM`.

### Landscape Mode (Phone Horizontal)

Layout splits into two columns:
1. **Left area** (flex: 1): Word display with progress bar at bottom. Same hidden info bar behavior. Word gets maximum width.
2. **Right panel** (120px fixed width): Dark surface background (`--bg-surface`), border-left separator. Contains vertically stacked:
   - WPM value at top (22px bold accent + "WPM" label)
   - Vertical joystick in middle (track: 26px wide, 90px tall. Thumb: 36x30px. Push up = increase, push down = decrease)
   - Transport buttons at bottom (skip: 36px, play: 42px, row layout with 6px gap)

### Hidden Info Bar

The info bar contains: back button, chapter name, progress %, WPM readout, theme toggle.

Behavior:
- Hidden by default on phone (both orientations)
- Tap the word display area to show — appears as an overlay at the top with semi-transparent dark background
- Tap again or wait 3 seconds to auto-hide
- On desktop: always visible (no change from current)

Implementation: Toggle a `showInfoBar` state variable. Use CSS transitions for fade in/out. The info bar is positioned `absolute` over the word display so it doesn't shift layout.

### WPM Rate Joystick

A spring-loaded joystick that controls the **rate of change** of WPM, not the absolute value.

Behavior:
- Rests at center (neutral position) — WPM does not change
- Displacement from center maps to rate of change:
  - Gentle push: ~5 WPM/sec
  - Half push: ~25 WPM/sec
  - Full push: 50 WPM/sec (maximum)
- Mapping is linear: `rate = (displacement / maxDisplacement) * 50`
- Release: springs back to center with a CSS transition
- WPM is clamped to 100–1000 range
- WPM value updates live while joystick is held
- Orientation adapts:
  - **Landscape**: vertical joystick (up = increase, down = decrease)
  - **Portrait**: horizontal joystick (right = increase, left = decrease)

Implementation:
- Track touch events (`touchstart`, `touchmove`, `touchend`) on the joystick element
- On `touchmove`: calculate displacement from center, compute rate, start an animation frame loop that increments WPM by `rate * deltaTime`
- On `touchend`: reset displacement to 0, stop the loop, persist final WPM
- Use `requestAnimationFrame` for smooth updates
- The joystick thumb position follows the touch within the track bounds

### Button Sizing

Interactive element sizes on phone. Portrait meets the 48px minimum tap target. Landscape buttons are intentionally smaller to fit the 120px panel — acceptable because the right-thumb reach is short and precise in landscape grip:

| Element | Current | Phone |
|---------|---------|-------|
| Skip buttons (⏮ ⏭) | ~18px emoji | 48px circle (portrait), 36px circle (landscape) |
| Play/Pause (▶ ⏸) | ~18px emoji | 56px circle (portrait), 42px circle (landscape) |
| Progress bar | 4px | 6px, rounded |
| Theme toggle | ~14px | 44px tap area |
| Back button | text link | 44px tap area |

### Font Scaling

Word display font size adapts:
- Desktop: 60px (unchanged)
- Portrait phone: `clamp(28px, 8vw, 48px)`
- Landscape phone: `clamp(32px, 6vh, 44px)`

### Desktop Behavior

No changes to desktop layout. All mobile styles are scoped behind media queries. The keyboard controls, mouse wheel WPM adjustment, and existing info bar all remain as-is.

## Technical Notes

- Joystick component: new Svelte component (`WpmJoystick.svelte`) that accepts `orientation: 'horizontal' | 'vertical'` prop and emits WPM change events
- Use `matchMedia` or Svelte reactive checks for orientation detection
- The joystick feel (rate curve, max rate) is intentionally easy to tune — exposed as constants at the top of the component
- Preferences store already persists WPM — joystick just calls the same setter

## Out of Scope

- Touch gestures on the word display (swipe to skip, etc.)
- Redesigning the home page or library page for mobile (follow-up work)
- PWA / offline support
- Accessibility improvements beyond tap target sizing

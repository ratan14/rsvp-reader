# RSVP Reader — Design Spec

## Overview

A web-based Rapid Serial Visual Presentation (RSVP) speed reader for long-form content. Users import text via file upload, paste, or URL, and read it one word at a time at a configurable speed. Progress is saved locally in the browser.

## Platform & Stack

- **Platform:** Web only, client-side SPA
- **Framework:** SvelteKit with `adapter-static`
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Svelte scoped styles + CSS custom properties for theming
- **Deployment:** Static hosting (Vercel, Netlify, GitHub Pages)

## Pages

### `/` — Home

Three input methods, each producing a `ContentResult` and navigating to `/read`:

1. **File upload** — drag-and-drop zone + file picker button. Accepts `.txt` and `.epub`.
2. **Paste text** — textarea for pasting raw text.
3. **URL input** — text field + "Fetch" button. Extracts article content using Readability.js.

### `/library` — Library

Lists previously imported content from localStorage. Each entry shows title, source type, progress percentage, and last-read timestamp. Tap to resume reading.

### `/read` — Reader

Full-screen RSVP reading experience. Focused minimal dark layout:

- **Info bar (top):** Chapter name (when available), progress percentage, current WPM. Thin and unobtrusive.
- **Word display (center):** Large word with ORP (Optimal Recognition Point) highlighted in accent color. Vertical guide markers above and below the ORP position to anchor the eye.
- **Controls (bottom):** Slim progress bar (clickable/draggable) and play/pause/skip transport controls.

Navigation bar is hidden on this page. Back button or Escape to exit.

## RSVP Engine

A standalone TypeScript module (`src/lib/engine/`) with no UI dependencies. Exposes state via Svelte stores.

### ReaderEngine

Manages playback state and timing:

- **Word queue** — parsed tokens from imported content
- **Playback state** — `playing | paused | stopped`, current word index
- **WPM** — base speed (range: 100–1000)
- **Variable timing** — per-word delay adjusted by:
  - Word length: factor = `length / 5.0`, clamped to [0.8, 2.0]
  - Punctuation: sentence-ending (`.?!`) gets 2x delay, clause-ending (`,:;`) gets 1.5x delay
- **ORP calculation** — approximately 1/3 from the left of each word, adjusted for short words. Returns the character index for UI highlighting.
- **Progress** — current index, percentage, chapter info when available

Timer uses `setTimeout` (not `setInterval`) to support variable per-word timing. Each word schedules the next.

### Text Parsing Pipeline

1. Raw input string from any importer
2. Split into paragraphs (preserves structure for EPUB chapter mapping)
3. Split paragraphs into words
4. Each word becomes a token: `{ text: string, index: number, chapterIndex?: number, orp: number }`

## Content Importers

All importers produce the same interface:

```typescript
interface ContentResult {
  title: string
  text: string
  chapters?: { title: string; charOffset: number }[]
  source: 'file' | 'paste' | 'url'
}
```

### File Importer

- `.txt` — read as UTF-8 string. No chapters. Title from filename.
- `.epub` — extract chapters and text using `epub.js` (or `jszip` + manual XML parsing). Chapters from EPUB spine/TOC.

### Paste Importer

- Raw text from textarea. Title defaults to first line or "Pasted text". No chapters.

### URL Importer

- Fetch URL content, run through Mozilla's Readability.js for clean article extraction.
- CORS: requires a proxy since the app is static-hosted. Options include a free service like allorigins or a Cloudflare Worker. The importer interface is the same regardless of proxy choice.

## Keyboard & Scroll Controls

| Input | Action |
|---|---|
| `Space` | Play / Pause |
| `Escape` | Stop and exit reader |
| `←` | Skip back 5 words |
| `→` | Skip forward 5 words |
| `Scroll wheel` | Adjust WPM by configurable step size |
| `↑` / `↓` | Adjust WPM by configurable step size |
| `Shift + scroll` | Adjust WPM by 1 (fine-tune override) |
| `Shift + ↑/↓` | Adjust WPM by 1 (fine-tune override) |
| `Home` | Jump to beginning |
| `End` | Jump to end |

WPM step size is a user preference (default: 5, range: 1–50). Shift modifier always steps by 1 regardless of setting.

Current WPM briefly pulses larger in the info bar when changed for immediate visual feedback.

Controls are handled by a single `keydown` listener at the `/read` page level.

## Themes

Two themes for MVP: **dark** (default) and **light**.

Implemented via CSS custom properties on `:root`, toggled by `data-theme` attribute on `<html>`:

- `--bg`, `--bg-surface` — background, controls panel
- `--text`, `--text-muted` — primary and secondary text
- `--accent` — ORP highlight, progress bar, active controls
- `--border`

Toggle accessible from the reader info bar and on home/library pages. Preference saved in localStorage.

## Data & Persistence

All state in **localStorage**.

### Library Entry (per content item)

```typescript
interface LibraryEntry {
  id: string              // hash of title + source
  title: string
  source: 'file' | 'paste' | 'url'
  sourceRef: string       // filename, URL, or 'pasted'
  currentIndex: number
  totalWords: number
  chapters?: { title: string; wordOffset: number }[]
  lastRead: number        // timestamp
  wpm: number             // per-content speed preference
  cachedText: string      // full text for resume without re-import
}
```

### User Preferences (global)

```typescript
interface UserPreferences {
  defaultWpm: number
  theme: 'dark' | 'light'
  variableSpeed: boolean
  pauseAtPunctuation: boolean
  wpmStepSize: number     // default: 5, range: 1-50
}
```

Full text is cached in localStorage for resume. If storage is full (approaching ~5MB limit), the reading session still works but progress/text won't persist — a warning is shown in the info bar.

No IndexedDB for MVP. Natural upgrade path if storage limits become a problem.

## Error Handling

Inline error messages at the point of failure. No toast system, no error boundaries, no retry logic.

- **File upload:** Validate extension before parsing. Show "Couldn't read this file" on parse failure.
- **URL fetch:** Show error inline on network/CORS failure. If Readability.js can't extract content, suggest paste as fallback.
- **Empty content:** If any importer produces zero words, show "No readable text found" instead of entering reader.
- **localStorage full:** Reading session continues. Show "Progress won't be saved — storage full" in info bar.
- **EPUB malformed:** If chapter extraction fails but text succeeds, proceed without chapters. If both fail, show error.

## Out of Scope for MVP

- User accounts / cloud sync
- PDF support
- Multi-word chunk display
- Custom fonts or accent colors
- Component library / polished UI (deferred to post-MVP phase)
- Offline/PWA support
- Mobile-specific optimizations

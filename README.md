# LyricsMind

A Chrome extension that enriches your music listening experience with **Genius annotations, song context, and cultural interpretations** — displayed in a sleek sidebar while you listen on YouTube Music or Spotify.

Unlike simple lyrics extensions, LyricsMind focuses on the *meaning behind the music*: artist commentary, lyric interpretations, production credits, and background context sourced from Genius. Lyrics are only shown when the platform isn't already displaying them.

## Features

- **Automatic song detection** — Detects the currently playing song on YouTube Music and Spotify via DOM observation with MutationObserver
- **Genius annotations** — Fetches lyric-specific annotations and interpretations from the Genius API
- **Song context** — Displays song description, producers, writers, release date, album info, and Genius page views
- **Conditional lyrics** — Fetches time-synced lyrics from LRCLIB only when the platform isn't already showing them
- **Time-synced highlighting** — Active lyric line highlighted in real-time based on playback position
- **Dark-themed sidebar** — Non-intrusive UI that matches the aesthetic of music streaming platforms
- **Keyboard toggle** — Cmd+Shift+L (Mac) / Ctrl+Shift+L (Windows/Linux) to show/hide the sidebar

## Architecture

```
Content Scripts (youtube-music.ts, spotify.ts)
  ├── MutationObserver detects song changes
  ├── Polls playback position every 1s
  ├── Injects sidebar iframe into page
  └── Relays data to sidebar via postMessage
          │
          ▼
Background Service Worker (background/index.ts)
  ├── Genius API: search → song details → annotations
  ├── LRCLIB API: time-synced + plain lyrics (conditional)
  ├── In-memory cache (title|artist keyed)
  └── Returns aggregated data to content script
          │
          ▼
Sidebar App (sidebar/App.tsx)
  ├── Song header with album art
  ├── Metadata badges (producers, writers, views)
  ├── Expandable "About" section
  ├── Annotation cards with lyric referents
  └── Conditional lyrics tab with time-sync
```

## Setup

### Prerequisites

- Node.js 18+
- A free [Genius API token](https://genius.com/api-clients)

### Build

```bash
npm install
npm run build
```

This produces a loadable extension in the `dist/` directory.

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Configure Genius API Token

1. Click the LyricsMind extension icon in the Chrome toolbar
2. Paste your Genius API **Client Access Token** into the input field
3. Click **Save Token**

To get a token: visit [genius.com/api-clients](https://genius.com/api-clients), create a new API client (any URL is fine for the app website field), and copy the **Client Access Token**.

### Development

```bash
npm run dev
```

Runs `vite build --watch` so the extension rebuilds on file changes. After each rebuild, go to `chrome://extensions` and click the reload button on the LyricsMind card.

## Usage

- The sidebar appears automatically on **music.youtube.com** and **open.spotify.com**
- Press **Cmd+Shift+L** (Mac) or **Ctrl+Shift+L** (Windows/Linux) to toggle the sidebar
- Click the extension icon to open settings (token configuration, enable/disable)
- Click annotation cards to expand/collapse full interpretation text
- Click the **Genius** link in the header to open the full Genius page for the song

## Tech Stack

- **Extension format:** Chrome Manifest V3
- **UI:** React 19 + Tailwind CSS
- **Build:** Vite with multi-entry Rollup config
- **Language:** TypeScript
- **APIs:** [Genius API](https://docs.genius.com) (annotations/context), [LRCLIB](https://lrclib.net) (lyrics)
- **Style isolation:** iframe-based sidebar prevents CSS conflicts with host pages

## Project Structure

```
src/
├── background/index.ts      # Service worker: API fetching, caching, coordination
├── content/
│   ├── youtube-music.ts     # YouTube Music song detection + sidebar injection
│   └── spotify.ts           # Spotify Web Player song detection + sidebar injection
├── sidebar/
│   ├── App.tsx              # Main sidebar React app (annotations, context, lyrics)
│   └── main.tsx             # React entry point
├── popup/
│   ├── App.tsx              # Extension popup (settings, token input)
│   └── main.tsx             # React entry point
├── utils/
│   └── messages.ts          # Shared TypeScript interfaces and message types
└── styles/
    └── index.css            # Tailwind CSS imports
```

# LyricsMind - Project Context

## What Is It

LyricsMind is a Chrome browser extension that displays synchronized lyrics and rich contextual annotations (similar to Genius.com) in a sidebar while users listen to music on YouTube Music and Spotify Web Player.

## Core Value Proposition

- Automatically detect the currently playing song from the streaming platform
- Fetch and display lyrics with time-synchronization to playback
- Show contextual annotations: background info, trivia, artist commentary, cultural references
- Non-intrusive sidebar UI that enhances rather than disrupts the listening experience

## Target Platforms

- **YouTube Music** (music.youtube.com)
- **Spotify Web Player** (open.spotify.com)

## Milestone Roadmap

1. **POC - Static Display**: Basic extension structure, song detection via DOM scraping, sidebar UI, static lyrics and annotations from at least one API source
2. **Time-Synchronized Display**: LRC-format synced lyrics, real-time playback position tracking, auto-scrolling with current line highlighting, timed annotation display
3. **Interactive Features & Rich Content**: Click-to-seek on lyrics, expandable annotations with source attribution, multi-source annotations, user preference settings, keyboard shortcuts
4. **Contextual Information & Trivia**: Song metadata (credits, chart performance, genre), cultural/historical context, sample detection, artist relationship maps, time-synced trivia cards
5. **Advanced Features (Stretch)**: AI-powered lyric interpretation, multi-language translation, community annotations, visual enhancements (album art theming), export/sharing, cross-platform sync, mini-player mode

## Song Detection Approach

- Content scripts injected into YouTube Music and Spotify pages
- DOM scraping with CSS selectors to extract song title, artist, and playback position
- MutationObserver for detecting song changes
- Polling (100-200ms) or event-based tracking for playback position
- Debouncing (200-300ms) to handle rapid song skipping
- Fallback selector patterns to handle UI updates from the platforms

## Lyrics & Annotation Sources

| Source | Type | Auth Required | Best For |
|--------|------|---------------|----------|
| Genius API | Official | API token | Annotations, artist commentary, cultural context |
| Musixmatch API | Official | API key | Time-synced lyrics (LRC), licensed/legal lyrics |
| LRCLIB | Community/Free | None | Free time-synced lyrics, no rate limits |
| Lyrics.ovh | Aggregator | None | Fallback plain lyrics |
| Spotify Internal API | Reverse-engineered | User cookies | Time-synced lyrics (TOS risk) |
| YouTube Music Internal API | Reverse-engineered | User cookies | Platform-native lyrics (unofficial) |

**Fallback strategy**: Genius -> LRCLIB -> Platform internal API -> Lyrics.ovh

## Data Flow

1. Content script detects song change via DOM observation
2. Check local cache (IndexedDB) for existing data
3. On cache miss: message background service worker to fetch from APIs
4. Background worker queries sources, aggregates results, caches them
5. Processed data sent back to content script via message passing
6. Sidebar UI renders lyrics and annotations

## Tech Stack Expectations

- **Extension format**: Chrome Manifest V3
- **UI framework**: React with Tailwind CSS (or Vue.js as alternative)
- **Style isolation**: Shadow DOM or iframe to avoid conflicts with host page CSS
- **Language**: TypeScript recommended
- **Build tool**: Webpack or Vite
- **State management**: React useState/useContext initially; Redux/Zustand for later milestones
- **Caching**: IndexedDB for local lyrics/annotation storage
- **Testing**: Jest (unit), Playwright/Puppeteer (E2E)

## Architecture Components

- **Background Service Worker**: API requests (avoids CORS), caching, coordination between content scripts and popup
- **Content Scripts**: Platform-specific (one per platform), DOM scraping, sidebar injection, message passing
- **Sidebar App**: React/Vue app rendered in the sidebar, lyrics display, annotation cards, interactive features
- **Popup**: Settings panel via extension icon, enable/disable toggle, preferences

## UI Design Notes

- Sidebar: 320-400px width, fixed overlay, high z-index
- Dark mode default (matches music platforms), optional light mode
- Auto-collapse on narrow screens (<1200px)
- Toggle shortcut: Alt+L
- Current lyric line positioned at ~30% from top for reading context
- Annotations appear as floating cards or inline expandable sections
- Accessibility: WCAG AA contrast, ARIA labels, keyboard navigation, reduced motion support

## Key Quality Targets

- Lyric sync accuracy: < 200ms deviation
- Annotation fetch success rate: > 90%
- Sidebar load time: < 500ms
- Must respect API rate limits

## Reference Projects

- [Web Scrobbler](https://github.com/web-scrobbler/web-scrobbler) - Song detection patterns for 200+ music sites
- [Better Lyrics](https://github.com/better-lyrics/better-lyrics) - Time-synced lyrics for YouTube Music
- [spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api) - Spotify internal lyrics access
- [ytmusicapi](https://github.com/sigma67/ytmusicapi) - YouTube Music internal API access

## Recommended Starting Point

Begin with Milestone 1 focusing on YouTube Music only (simpler DOM structure), basic sidebar with static lyrics from Genius API. Validate the concept before adding time-sync complexity.

# LyricsMind — Design Document

*Chrome Extension for YouTube Music & Spotify*

---

## Overview

LyricsMind is a Chrome Manifest V3 extension that injects a 380px sidebar into YouTube Music and Spotify. While a song plays, the sidebar automatically fetches and displays three layers of content:

1. **Context tab** — Genius annotations, song metadata, and production credits
2. **Lyrics tab** — Time-synced lyrics from LRCLIB, highlighted as the song plays
3. **Interpretation tab** — AI-generated whole-song and stanza-by-stanza analysis grounded in the actual fetched lyrics

The extension works without any local server. All API calls are made from the background service worker to avoid CORS restrictions.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Music Platform (YouTube Music / Spotify) │
│                                                       │
│  ┌─────────────────────────┐                          │
│  │  Content Script         │                          │
│  │  (youtube-music.ts /    │                          │
│  │   spotify.ts)           │                          │
│  │                         │                          │
│  │  • MutationObserver     │                          │
│  │    detects song changes │                          │
│  │  • Polls playback pos   │◄──── chrome.runtime ────►│
│  │    every 1 second       │      sendMessage         │
│  │  • Injects iframe       │                          │
│  │  • Relays messages      │                          │
│  │    between sidebar      │                          │
│  │    and background       │                          │
│  └────────────┬────────────┘                          │
│               │ postMessage                           │
│  ┌────────────▼────────────┐                          │
│  │  Sidebar (iframe)       │                          │
│  │  sidebar/App.tsx        │                          │
│  │                         │                          │
│  │  • React 19 + Tailwind  │                          │
│  │  • 3-tab UI             │                          │
│  │  • Time-sync highlight  │                          │
│  │  • Collapsible sections │                          │
│  └─────────────────────────┘                          │
└─────────────────────────────────────────────────────┘
                      │
                      │ chrome.runtime.sendMessage
                      ▼
┌─────────────────────────────────────────────────────┐
│  Background Service Worker (background/index.ts)     │
│                                                       │
│  • Genius API (search + song detail + annotations)   │
│  • LRCLIB (time-synced + plain lyrics)               │
│  • AI API (OpenAI-compatible: insights + fallback)   │
│  • In-memory cache keyed by normalized title+artist  │
└──────────────────────────────┬──────────────────────┘
                               │ fetch()
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
             Genius API    LRCLIB     AI API
          api.genius.com  lrclib.net  (Gemini /
                                       OpenAI)
```

---

## Component Breakdown

### 1. Content Scripts (`src/content/`)

Two nearly identical scripts run on `music.youtube.com` and `open.spotify.com` respectively.

**Responsibilities:**
- Inject the sidebar `<div>` + `<iframe>` into the page DOM on load
- Detect the currently playing song via DOM scraping
- Observe DOM changes with `MutationObserver` to detect song changes
- Poll playback position every **1 second** and relay it to the sidebar
- Bridge messages between the sidebar iframe (`postMessage`) and the background service worker (`chrome.runtime.sendMessage`)
- Handle keyboard shortcut toggle via `chrome.runtime.onMessage`

**Song detection — YouTube Music:**
- Title: `.title.ytmusic-player-bar`
- Artist: `.byline.ytmusic-player-bar` — splits on `"•"` to extract just the artist from `"Artist • Album • Year"` format
- Album art: `.thumbnail-image-wrapper img`
- Observer target: `ytmusic-player-bar` element
- Playback time: `.time-info` text content, split on `"/"`, with `#progress-bar[value]` as fallback

**Song detection — Spotify:**
- Title: `[data-testid="context-item-link"]` with fallback to `a[href*='/track/']`
- Artist: `[data-testid="context-item-info-subtitles"] a` with fallback to `a[href*="/artist/"]`
- Album art: first `<img>` inside `[data-testid="now-playing-widget"]`
- Observer target: `[data-testid="now-playing-widget"]` with fallbacks to `.now-playing-bar` then `footer`
- Playback time: `[data-testid="playback-position"]`

**Debouncing:** MutationObserver callbacks are debounced at **300ms** to avoid redundant API calls during rapid DOM updates.

**Platform lyrics detection:** Both scripts detect whether the platform is already showing its own lyrics panel (`[data-testid="lyrics-button"][aria-pressed="true"]` on Spotify; `ytmusic-description-shelf-renderer[has-lyrics]` on YouTube Music). This flag is passed to the sidebar to suppress the Lyrics tab when not needed.

**Sidebar injection:** The sidebar is a fixed-position `<div>` (380px wide, full viewport height, `z-index: 99999`) containing an `<iframe>` that loads `sidebar.html`. Using an iframe provides complete CSS isolation from the host page. Show/hide is implemented via CSS `transform: translateX(0/100%)` for smooth animation without layout reflow.

---

### 2. Background Service Worker (`src/background/index.ts`)

The service worker handles all network requests (to avoid CORS issues) and maintains an in-memory cache while it is alive.

#### Title & Artist Normalization

Before any API call, song titles and artists are cleaned to improve match rates, especially for live versions, covers, and remasters:

**Title strip patterns (applied in order):**
- `(Live at X)`, `(Live)`, `(En Vivo)` — all parenthesized live variants
- `(Acoustic)`, `(Unplugged)`, `(Stripped)`
- `(Cover)`, `(Tribute)`, `(Originally Performed By X)`
- `(Remix)`, `(Demo)`, `(Alternate)`
- `(Remastered)`, `(Deluxe)`, `(Extended)`, `(Radio Edit)`
- `(feat. X)`, `(ft. X)`
- `(2015 Remaster)`, `(2015 Live Version)` — year-first parenthetical formats
- `[Live]`, `[Acoustic]`, `[Remix]` — bracketed variants
- `- Live 2019`, `- Remastered 2015` — dash-suffix variants with optional year

**Artist normalization:** Strips everything from `feat./ft./featuring/with/&/,` onwards to extract the primary artist.

#### Fuzzy Song Verification (`verifySongMatch`)

After any API search returns a result, it is verified against the requested song to prevent wrong-song matches:

1. Both titles are normalized (punctuation stripped, lowercased, split into word sets)
2. A word overlap score `(shared words / min set size)` is computed for title and artist
3. Pass conditions:
   - Title score ≥ 0.8 (near-perfect title match, artist not required), **or**
   - Title score ≥ 0.5 **and** artist score ≥ 0.5

Using `min(wordsA.size, wordsB.size)` as the denominator means short canonical titles ("Yesterday") score 1.0 against long live titles ("Yesterday (Live at Royal Albert Hall)") — the extra words in the live title don't penalise the score.

#### Genius API Pipeline

For each song:

1. `normalizeTitle` to get `cleanTitle` and `wasModified` flag
2. If title was modified (live/cover/etc.), **search Genius with the clean title first** to get the richer canonical annotations
3. Fall back to the original title if clean search returns nothing
4. Within `searchGenius`, preliminary string matching selects the best hit before `verifySongMatch` validates it
5. Song details and annotations are fetched **in parallel** via `Promise.all`

**Data returned:**
- Title, artist, album, release date
- Plain-text song description
- Up to 20 annotations (referent text + explanation body)
- Genius page URL, album art, header image
- Producers, writers, page view count

#### LRCLIB Lyrics Pipeline

LRCLIB is the primary lyrics source. For live/cover/variant titles, the **clean title is searched first** (canonical version is more likely to have synced lyrics). Falls back to the original title if nothing found.

Three-pass strategy:
1. Search with clean title (if title was modified)
2. Fall back to original title
3. If a result was found but has **no actual lyrics content** (`plainLyrics` and `syncedLyrics` both null — can happen when LRCLIB has a live track entry with no text), try the alternate query

Synced lyrics (LRC format) are parsed into `{ time: number, text: string }[]` arrays. The LRC regex handles both 2-digit and 3-digit millisecond fields.

**Cache key:** `${normalizedTitle}|${normalizedArtist}` — live and studio versions of the same song share the same cache entry.

#### AI Fallback (`fetchAIFallback`)

Triggered automatically when either Genius annotations or LRCLIB lyrics are missing after the initial fetch. The sidebar's `useEffect` detects the gap and sends `REQUEST_AI_FALLBACK` to the content script.

The AI is asked to produce:
- **Annotations:** A JSON array of `{ referent, body }` objects tied to actual lyric lines
- **Lyrics:** Raw plain lyrics text (no headers or commentary)

If synced lyrics are available (from LRCLIB), they are included in the prompt as reference material so the AI can use exact lyric text as referents.

#### AI Interpretation (`fetchAIInsights`)

Triggered on-demand when the user opens the Interpretation tab.

**Prompt structure:**
- Song title and artist
- If lyrics are available: wrapped in `=== LYRICS (quote ONLY from this text) ===` markers
- If no lyrics: explicit `[No lyrics provided]` marker

**Generated sections (markdown `##` headers):**
- **Summary** — one paragraph on the song's whole-song meaning, theme, and emotional arc
- **Lyric Breakdown** — stanza by stanza; each stanza has lyric lines in `*italics*` followed immediately by 1-2 sentences of interpretation
- **Inspiration & Background** — omitted if not well-documented
- **Cultural Impact** — omitted if not well-documented
- **Trivia** — omitted if not well-documented

**Anti-hallucination measures:**
- System prompt explicitly forbids quoting from training knowledge; ONLY the provided `=== LYRICS ===` block may be used
- If no lyrics block exists, the system prompt instructs zero lyric quotes
- Cache key includes a `|true`/`|false` suffix for whether lyrics were present, preventing a lyric-less (potentially hallucinated) result from being served when lyrics later become available

**AI provider:** Defaults to Google Gemini 2.0 Flash via the OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai`). Configurable to any OpenAI-compatible API via popup settings (base URL + model + API key).

#### Caching

Two separate in-memory `Map` caches:
- **`cache`** — Genius + LRCLIB data, keyed by `${normalizedTitle}|${normalizedArtist}`
- **`aiCache`** — AI interpretation text, keyed by `ai|${normalizedTitle}|${normalizedArtist}|${hasLyrics}`
- **`aiFallbackCache`** — AI fallback annotations/lyrics, keyed by title/artist/needs flags

All caches are in-memory only. They persist while the service worker is alive (typically minutes to hours) and are cleared when Chrome recycles the worker.

---

### 3. Sidebar App (`src/sidebar/App.tsx`)

A React 19 app served inside the iframe. Receives all data via `window.addEventListener("message")` from the parent content script.

#### Message Protocol

| Message type | Direction | Payload |
|---|---|---|
| `SONG_UPDATE` | content → sidebar | `{ title, artist, albumArt, platformHasLyrics }` |
| `GENIUS_DATA` | content → sidebar | Genius song data object or null + error |
| `LYRICS_DATA` | content → sidebar | `{ syncedLyrics, plainLyrics }` |
| `PLAYBACK_UPDATE` | content → sidebar | `{ currentTime, isPlaying }` |
| `LOADING` | content → sidebar | boolean |
| `AI_FALLBACK` | content → sidebar | `{ annotations?, plainLyrics? }` |
| `AI_INSIGHTS` | content → sidebar | interpretation markdown string |
| `AI_LOADING` | content → sidebar | boolean |
| `REQUEST_AI_FALLBACK` | sidebar → content | `{ title, artist, needsAnnotations, needsLyrics, syncedLyrics }` |
| `REQUEST_AI_INSIGHTS` | sidebar → content | `{ title, artist, lyricsText }` |

#### Tab: Context

Shows Genius data: song description (collapsible after 3 lines), producer/writer/release date badges, page view count, and a link to the full Genius page.

Below the metadata, annotation cards are listed in timestamp order. Each card shows the **referent** (quoted lyric fragment) and the **annotation body** (expandable). Annotations are time-synced to the current playback position using `matchAnnotationsToTimestamps`.

**Annotation time-sync:** Genius annotations reference lyric text but have no timestamps. These are mapped to timestamps by fuzzy-matching each annotation's referent string against the LRCLIB synced lyrics:
1. Normalize both strings (lowercase, strip punctuation)
2. Check exact substring match within a 3-line sliding window
3. Fall back to word overlap scoring
4. If no synced lyrics exist, spread annotations evenly across a 4-minute notional song duration

#### Tab: Lyrics

If synced lyrics are available, lines are rendered with the current active line highlighted and the list auto-scrolls using `scrollIntoView({ behavior: "smooth", block: "center" })`. The active index is computed by scanning backwards through the sorted time array for the last line whose timestamp ≤ current playback time.

If only plain lyrics are available (no timestamps), they are rendered in a `<pre>` block.

If neither is available, an AI fallback has already been triggered automatically.

#### Tab: Interpretation

Parses the AI markdown response by splitting on `\n## ` to extract named sections. Each section is rendered as a `CollapsibleAISection` card (expandable past 120px with a Show More / Show Less button). The content div always has `overflow: hidden` to prevent content from overflowing the button.

The **Lyric Breakdown** section uses a specialized `LyricBreakdownContent` renderer instead of the generic `SimpleMarkdown`:
- The content is split into stanza blocks on blank lines
- Within each block, leading lines matching `/^\*([^*].*)\*$/` (italic markers) are extracted as the lyric quote and rendered in italic (`text-white/85 italic`)
- Remaining lines are the interpretation, rendered in regular weight (`text-white/65`)
- A `mb-1.5` gap separates quote from interpretation visually

**Late-lyrics re-fetch:** If the user opens the Interpretation tab before the AI lyrics fallback completes, the request fires without lyrics. The `aiFetchedWithoutLyrics` ref tracks this. When lyrics subsequently arrive (via `AI_FALLBACK`), a `useEffect` watching the `lyrics` state automatically resets the insights state and re-fires the interpretation request with the real lyrics — but only if the user is still on the Interpretation tab.

#### Inline Markdown Renderer (`SimpleMarkdown` + `formatInline`)

A lightweight parser for the AI-generated text. `SimpleMarkdown` groups non-blank lines into paragraphs separated by blank lines. `formatInline` applies inline formatting via regex:
- `**text**` → `<strong>`
- `*text*` → `<em>`
- `` `text` `` → `<code>`
- `[text](url)` → `<a target="_blank">`

---

### 4. Popup (`src/popup/App.tsx`)

A 320px settings panel accessed via the extension toolbar icon. Stores all settings in `chrome.storage.local`:

| Setting | Key | Purpose |
|---|---|---|
| Sidebar enabled | `enabled` | Toggle sidebar injection on/off |
| Genius token | `geniusToken` | Client Access Token for Genius API |
| AI API key | `aiApiKey` | Key for Gemini or OpenAI-compatible provider |
| AI base URL | `aiBaseUrl` | Defaults to Gemini's OpenAI-compatible endpoint |
| AI model | `aiModel` | Defaults to `gemini-2.0-flash` |

---

## Data Flow: Song Change to Fully Rendered Sidebar

```
1. MutationObserver fires on player bar DOM change
        │
        ▼ (debounced 300ms)
2. detectCurrentSong() → { title, artist, albumArt, platformHasLyrics }
        │
        ├─► postMessage SONG_UPDATE → sidebar resets state, shows loading
        │
        ▼
3. chrome.runtime.sendMessage FETCH_SONG_DATA
        │
        ▼
4. Background: normalizeTitle(title) + normalizeArtist(artist)
   Check cache → if hit, return immediately
        │
        ├─► fetchGeniusData (clean title first, original as fallback)
        │     └─► searchGenius → verifySongMatch → song detail + annotations (parallel)
        │
        └─► fetchLRCLIB (clean title first, original as fallback)
              └─► searchLRCLIB → verifySongMatch → parseLRC
        │
        ▼ (both resolve via Promise.all)
5. Result cached and returned to content script
        │
        ├─► postMessage GENIUS_DATA → sidebar renders Context tab
        └─► postMessage LYRICS_DATA → sidebar renders Lyrics tab

6. Sidebar useEffect: if annotations missing OR lyrics missing
        └─► postMessage REQUEST_AI_FALLBACK → content → background
              └─► fetchAIFallback → AI API → annotations / plain lyrics
                    └─► postMessage AI_FALLBACK → sidebar fills gaps

7. User clicks Interpretation tab
        └─► postMessage REQUEST_AI_INSIGHTS (with lyricsText if available)
              └─► content → background → fetchAIInsights → AI API
                    └─► postMessage AI_INSIGHTS → sidebar renders breakdown
```

---

## Build System

**Vite** with a multi-entry Rollup config produces five separate bundles in `dist/`:

| Entry | Output |
|---|---|
| `popup.html` | `dist/popup.html` + `dist/popup.js` |
| `sidebar.html` | `dist/sidebar.html` + `dist/sidebar.js` |
| `src/background/index.ts` | `dist/background.js` |
| `src/content/youtube-music.ts` | `dist/content/youtube-music.js` |
| `src/content/spotify.ts` | `dist/content/spotify.js` |

Shared React/React-DOM chunks are output to `dist/chunks/`. CSS is extracted to `dist/assets/`.

Content scripts must be plain JS files (not ES modules) — Vite's Rollup output is configured with `entryFileNames: "[name].js"` and no module format override, which produces IIFE-compatible output suitable for `run_at: document_idle` injection.

---

## Key Design Decisions

**iframe sidebar instead of injected DOM**
Injecting React directly into the page DOM risks CSS conflicts with the host site's stylesheets. An iframe gives complete style isolation at the cost of a slightly more complex message-passing layer.

**Background service worker for all API calls**
Content scripts cannot directly call external APIs due to CORS restrictions. All fetch calls live in the service worker, which has no origin restriction when the hosts are declared in `manifest.json`.

**Clean title first, original title as fallback**
For live/cover/remix variants, the canonical song is far more likely to have lyrics and annotations than the variant. Searching with the cleaned title first avoids returning a live-version entry with no lyrics content.

**Word overlap scoring over string distance**
Levenshtein distance is sensitive to title length. Word overlap (matches / min set size) correctly handles the case where a short canonical title ("Yesterday") is compared against a long variant title ("Yesterday (Live at Royal Albert Hall 1965)") — the score is 1.0 because all words in the shorter set appear in the longer one.

**In-memory cache, not IndexedDB**
The service worker cache is simple to implement and sufficient for a listening session. IndexedDB would persist across sessions but adds meaningful complexity. Songs are rarely replayed within seconds, so in-memory is adequate.

**On-demand AI interpretation**
AI calls are expensive in latency and API cost. The interpretation is only fetched when the user actively opens the Interpretation tab, not pre-emptively on every song change.

**Lyrics grounding for AI interpretation**
AI models can hallucinate lyrics even for well-known songs. The actual LRCLIB lyrics are passed in a clearly delimited `=== LYRICS ===` block and the model is explicitly instructed to quote only from that block, never from training knowledge.

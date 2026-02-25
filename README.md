# LyricsMind

A Chrome extension that enriches your music listening experience with **Genius annotations, synced lyrics, and AI-powered interpretations** — displayed in a sleek sidebar while you listen on YouTube Music or Spotify.

---

## What It Does

While a song plays, LyricsMind opens a sidebar with three tabs:

| Tab | What you get |
|---|---|
| **Context** | Genius annotations, song description, producers, writers, release date |
| **Lyrics** | Time-synced lyrics that highlight the current line as the song plays |
| **Interpretation** | AI-generated stanza-by-stanza breakdown grounded in the actual lyrics |

Live versions, acoustic versions, remixes, and cover songs are automatically detected and matched to their canonical lyrics.

---

## Installation

### Option A — Load the pre-built extension (no coding required)

1. **Download** the latest `dist.zip` from the [Releases](../../releases) page (or ask whoever shared this with you for the zip file).
2. **Unzip** it anywhere on your computer. You will get a folder called `dist/`.
3. Open Chrome and go to **`chrome://extensions`**.
4. Turn on **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked**.
6. Select the `dist/` folder you just unzipped.
7. The LyricsMind icon will appear in your Chrome toolbar.

> **Note:** Chrome may warn you that the extension was not installed from the Web Store. This is expected for manually loaded extensions — click **Keep** if prompted.

---

### Option B — Build from source

**You will need:**
- [Node.js](https://nodejs.org) version 18 or newer (check with `node -v`)
- [Git](https://git-scm.com)

**Steps:**

```bash
# 1. Clone the repository
git clone https://github.com/shipoftd/LyricsMind.git
cd LyricsMind

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build
```

This produces a `dist/` folder in the project directory.

4. Open Chrome and go to **`chrome://extensions`**.
5. Turn on **Developer mode** (top-right toggle).
6. Click **Load unpacked** and select the `dist/` folder.

**To rebuild after making code changes:**
```bash
npm run dev   # watches for changes and rebuilds automatically
```
After each rebuild, go to `chrome://extensions` and click the **↺ reload** button on the LyricsMind card.

---

## Setup: API Keys

The extension needs two API keys to unlock all features. Both are **free**.

### 1. Genius API Token *(required for the Context tab)*

1. Go to [genius.com/api-clients](https://genius.com/api-clients) and sign in (or create a free account).
2. Click **New API Client**.
3. Fill in any name and any URL for "App Website URL" (e.g. `http://localhost`). Click **Save**.
4. Copy the **Client Access Token** shown on the next screen.

### 2. Gemini API Key *(required for the Interpretation tab)*

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account.
2. Click **Create API key**.
3. Copy the key (it starts with `AIza...`).

> **Using a different AI provider?** The Interpretation tab also works with OpenAI or any OpenAI-compatible API. See [Advanced Configuration](#advanced-configuration) below.

### Entering your keys

1. Click the **LyricsMind icon** in the Chrome toolbar to open Settings.
2. Paste your **Genius API Token** into the first field.
3. Paste your **Gemini API Key** into the second field.
4. Click **Save Settings**.

You only need to do this once — keys are stored locally in Chrome.

---

## Using the Extension

- Navigate to **[music.youtube.com](https://music.youtube.com)** or **[open.spotify.com](https://open.spotify.com)** and play a song.
- The sidebar appears automatically on the right side of the page.
- Press **Cmd+Shift+L** (Mac) or **Ctrl+Shift+L** (Windows/Linux) to show or hide it at any time.

### The three tabs

**Context**
Shows Genius annotations — tappable cards tied to specific lyric lines that explain references, metaphors, and background. Also shows producers, writers, release date, and a link to the full Genius page.

**Lyrics**
Displays time-synced lyrics fetched from [LRCLIB](https://lrclib.net). The current line is highlighted as the song plays and the view auto-scrolls. If LRCLIB doesn't have the song, the AI generates the lyrics as a fallback.

**Interpretation**
Generates an AI-powered breakdown of the song. The top section gives a whole-song interpretation (theme, emotional arc, meaning). Below that, the lyrics are broken down stanza by stanza — each section shows the lyric lines in *italics* followed by a plain-text explanation. The AI uses only the actual fetched lyrics, never fabricated ones.

---

## Advanced Configuration

By default the Interpretation tab uses **Google Gemini 2.0 Flash**. You can change this in Settings:

| Field | Default | Notes |
|---|---|---|
| **Base URL** | `https://generativelanguage.googleapis.com/v1beta/openai` | Any OpenAI-compatible endpoint works |
| **Model** | `gemini-2.0-flash` | e.g. `gpt-4o`, `claude-3-5-haiku`, etc. |

To use **OpenAI**:
- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4o` (or any model you have access to)
- API Key: your OpenAI key

To use **Anthropic Claude** via a compatible proxy, set the Base URL and model accordingly.

---

## Tech Stack

- **Chrome Manifest V3** — service worker, content scripts, popup
- **React 19 + Tailwind CSS** — sidebar and popup UI
- **TypeScript + Vite** — type-safe build with multi-entry Rollup config
- **iframe-based sidebar** — prevents CSS conflicts with the host page
- **APIs:** [Genius](https://docs.genius.com) · [LRCLIB](https://lrclib.net) · Google Gemini (or OpenAI-compatible)

## Project Structure

```
src/
├── background/index.ts      # Service worker: API fetching, caching, coordination
├── content/
│   ├── youtube-music.ts     # YouTube Music song detection + sidebar injection
│   └── spotify.ts           # Spotify Web Player song detection + sidebar injection
├── sidebar/
│   ├── App.tsx              # Main sidebar React app (annotations, lyrics, interpretation)
│   └── main.tsx             # React entry point
├── popup/
│   ├── App.tsx              # Extension popup (settings, token/key input)
│   └── main.tsx             # React entry point
└── utils/
    └── messages.ts          # Shared TypeScript interfaces and message types
```

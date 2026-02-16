# LyricsMind

Chrome extension that displays synchronized lyrics and contextual annotations while you listen to music on YouTube Music and Spotify.

## Setup

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

### Development

```bash
npm run dev
```

Runs `vite build --watch` so the extension rebuilds on file changes. After each rebuild, go to `chrome://extensions` and click the reload button on the LyricsMind card.

## Usage

- The sidebar appears automatically on **music.youtube.com** and **open.spotify.com**
- Press **Cmd+Shift+L** (Mac) or **Ctrl+Shift+L** (Windows/Linux) to toggle the sidebar
- Click the extension icon for a quick enable/disable toggle

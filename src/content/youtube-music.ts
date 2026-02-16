// LyricsMind - YouTube Music Content Script
// Detects currently playing song and manages sidebar injection.

import { injectSidebar, toggleSidebar } from "./shared";

function detectCurrentSong(): { title: string; artist: string } | null {
  // TODO: Implement DOM scraping for YouTube Music
  // Selectors: .title.ytmusic-player-bar, .byline.ytmusic-player-bar
  const titleEl = document.querySelector(
    ".title.ytmusic-player-bar"
  ) as HTMLElement | null;
  const artistEl = document.querySelector(
    ".byline.ytmusic-player-bar"
  ) as HTMLElement | null;

  if (titleEl?.textContent && artistEl?.textContent) {
    return {
      title: titleEl.textContent.trim(),
      artist: artistEl.textContent.trim(),
    };
  }
  return null;
}

function init() {
  console.log("LyricsMind: YouTube Music content script loaded");
  injectSidebar();

  // TODO: Set up MutationObserver to watch for song changes
  // TODO: Implement playback position tracking
  const song = detectCurrentSong();
  if (song) {
    console.log("LyricsMind: Detected song:", song);
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    toggleSidebar();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

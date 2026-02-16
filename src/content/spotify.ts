// LyricsMind - Spotify Web Player Content Script
// Detects currently playing song and manages sidebar injection.

import { injectSidebar, toggleSidebar } from "./shared";

function detectCurrentSong(): { title: string; artist: string } | null {
  // TODO: Implement DOM scraping for Spotify Web Player
  // Selectors: [data-testid="now-playing-widget"]
  const widget = document.querySelector(
    '[data-testid="now-playing-widget"]'
  ) as HTMLElement | null;

  if (!widget) return null;

  const titleEl = widget.querySelector("a[data-testid]") as HTMLElement | null;
  const artistEl = widget.querySelector(
    'a[href^="/artist"]'
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
  console.log("LyricsMind: Spotify content script loaded");
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

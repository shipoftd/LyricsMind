// LyricsMind - Spotify Web Player Content Script
// Detects currently playing song and manages sidebar injection.
export {};

const SIDEBAR_ID = "lyricsmind-sidebar";
const SIDEBAR_WIDTH = "380px";

function injectSidebar() {
  if (document.getElementById(SIDEBAR_ID)) return;

  const container = document.createElement("div");
  container.id = SIDEBAR_ID;
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${SIDEBAR_WIDTH};
    height: 100vh;
    z-index: 99999;
    border: none;
    transition: transform 0.3s ease;
    transform: translateX(100%);
  `;

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  container.appendChild(iframe);
  document.body.appendChild(container);
}

function toggleSidebar() {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    injectSidebar();
    return;
  }

  const isHidden = sidebar.style.transform === "translateX(100%)";
  sidebar.style.transform = isHidden ? "translateX(0)" : "translateX(100%)";
}

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

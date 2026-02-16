// LyricsMind - Spotify Web Player Content Script
export {};

const SIDEBAR_ID = "lyricsmind-sidebar";
const SIDEBAR_WIDTH = "380px";
const POLL_INTERVAL = 1000;
const DEBOUNCE_MS = 300;

let lastSongKey = "";
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let playbackPollId: ReturnType<typeof setInterval> | null = null;
let sidebarVisible = false;

function getSidebarIframe(): HTMLIFrameElement | null {
  const container = document.getElementById(SIDEBAR_ID);
  return container?.querySelector("iframe") ?? null;
}

function postToSidebar(message: unknown) {
  const iframe = getSidebarIframe();
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage(message, "*");
  }
}

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
    transform: translateX(0);
    box-shadow: -2px 0 12px rgba(0,0,0,0.4);
  `;

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.style.cssText = "width:100%;height:100%;border:none;";
  iframe.addEventListener("load", () => {
    const song = detectCurrentSong();
    if (song) {
      postToSidebar({ type: "SONG_UPDATE", payload: song });
      fetchSongData(song);
    }
  });

  container.appendChild(iframe);
  document.body.appendChild(container);
  sidebarVisible = true;
}

function showSidebar() {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (sidebar) {
    sidebar.style.transform = "translateX(0)";
    sidebarVisible = true;
  }
}

function hideSidebar() {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (sidebar) {
    sidebar.style.transform = "translateX(100%)";
    sidebarVisible = false;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    injectSidebar();
    return;
  }
  if (sidebarVisible) hideSidebar();
  else showSidebar();
}

function detectCurrentSong() {
  // Spotify's now-playing widget
  const widget = document.querySelector(
    '[data-testid="now-playing-widget"]'
  ) as HTMLElement | null;
  if (!widget) return null;

  // Song title - try multiple selectors for robustness
  const titleEl =
    (widget.querySelector('[data-testid="context-item-link"]') as HTMLElement) ??
    (widget.querySelector("a[href*='/track/']") as HTMLElement);
  // Artist
  const artistEl =
    (widget.querySelector('[data-testid="context-item-info-subtitles"] a') as HTMLElement) ??
    (widget.querySelector('a[href*="/artist/"]') as HTMLElement);
  // Album art
  const albumArtEl = widget.querySelector("img") as HTMLImageElement | null;

  if (!titleEl?.textContent || !artistEl?.textContent) return null;

  const platformHasLyrics = checkPlatformHasLyrics();

  return {
    title: titleEl.textContent.trim(),
    artist: artistEl.textContent.trim(),
    albumArt: albumArtEl?.src,
    platformHasLyrics,
  };
}

function checkPlatformHasLyrics(): boolean {
  // Spotify shows lyrics when the lyrics button is active or lyrics panel is visible
  const lyricsButton = document.querySelector(
    'button[data-testid="lyrics-button"][aria-pressed="true"]'
  );
  const lyricsPanel = document.querySelector(
    '[data-testid="lyrics-page"], .lyrics-lyrics-contentContainer'
  );
  return !!(lyricsButton || lyricsPanel);
}

function getPlaybackTime(): { currentTime: number; isPlaying: boolean } {
  const timeEl = document.querySelector(
    '[data-testid="playback-position"]'
  ) as HTMLElement | null;
  if (timeEl?.textContent) {
    const currentTime = parseTimeString(timeEl.textContent.trim());
    const isPlaying = !!document.querySelector(
      'button[data-testid="control-button-playpause"][aria-label="Pause"]'
    );
    return { currentTime, isPlaying };
  }
  return { currentTime: 0, isPlaying: false };
}

function parseTimeString(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

async function fetchSongData(song: ReturnType<typeof detectCurrentSong>) {
  if (!song) return;
  postToSidebar({ type: "LOADING", payload: true });

  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_SONG_DATA",
      payload: song,
    });

    if (response?.geniusData) {
      postToSidebar({ type: "GENIUS_DATA", payload: response.geniusData });
    } else {
      postToSidebar({
        type: "GENIUS_DATA",
        payload: null,
        error: response?.error ?? "No data found",
      });
    }

    // Always send lyrics data — needed for annotation time-sync even if
    // the platform is already showing lyrics (display is controlled in sidebar)
    if (response?.lyricsData) {
      postToSidebar({ type: "LYRICS_DATA", payload: response.lyricsData });
    }
  } catch (err) {
    console.error("LyricsMind: fetch error", err);
    postToSidebar({ type: "GENIUS_DATA", payload: null, error: "Failed to fetch data" });
  } finally {
    postToSidebar({ type: "LOADING", payload: false });
  }
}

function onSongChange() {
  const song = detectCurrentSong();
  if (!song) return;

  const songKey = `${song.title}|${song.artist}`;
  if (songKey === lastSongKey) return;
  lastSongKey = songKey;

  console.log("LyricsMind: Song changed ->", song.title, "-", song.artist);
  postToSidebar({ type: "SONG_UPDATE", payload: song });
  fetchSongData(song);
}

function startPlaybackTracking() {
  if (playbackPollId) clearInterval(playbackPollId);
  playbackPollId = setInterval(() => {
    if (!sidebarVisible) return;
    const playback = getPlaybackTime();
    postToSidebar({ type: "PLAYBACK_UPDATE", payload: playback });
  }, POLL_INTERVAL);
}

function setupObserver() {
  // Watch the now-playing widget area for changes
  const target =
    document.querySelector('[data-testid="now-playing-widget"]') ??
    document.querySelector(".now-playing-bar") ??
    document.querySelector("footer");

  if (!target) {
    setTimeout(setupObserver, 1000);
    return;
  }

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onSongChange, DEBOUNCE_MS);
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  onSongChange();
}

function init() {
  console.log("LyricsMind: Spotify content script loaded");
  injectSidebar();
  setupObserver();
  startPlaybackTracking();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    toggleSidebar();
  }
});

// Listen for requests from sidebar iframe
window.addEventListener("message", async (event) => {
  const msg = event.data;
  if (msg?.type === "REQUEST_AI_INSIGHTS" && msg.payload) {
    postToSidebar({ type: "AI_LOADING", payload: true });
    try {
      const response = await chrome.runtime.sendMessage({
        type: "FETCH_AI_INSIGHTS",
        payload: msg.payload,
      });
      postToSidebar({ type: "AI_INSIGHTS", payload: response.aiInsights ?? null, error: response.error });
    } catch (err) {
      postToSidebar({ type: "AI_INSIGHTS", payload: null, error: "Failed to fetch AI insights" });
    } finally {
      postToSidebar({ type: "AI_LOADING", payload: false });
    }
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

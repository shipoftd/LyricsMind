// LyricsMind - Background Service Worker
// Handles Genius API + LRCLIB fetching, caching, and coordination.

const LRCLIB_BASE = "https://lrclib.net/api";
const GENIUS_API_BASE = "https://api.genius.com";
const GENIUS_SEARCH_URL = "https://api.genius.com/search";

// Simple in-memory cache (persists while service worker is alive)
const cache = new Map<string, { geniusData: unknown; lyricsData: unknown }>();

async function getGeniusToken(): Promise<string | null> {
  const result = await chrome.storage.local.get("geniusToken");
  return result.geniusToken ?? null;
}

// ---- Genius API ----

interface GeniusSearchHit {
  result: {
    id: number;
    title: string;
    primary_artist: { name: string };
    song_art_image_url?: string;
    header_image_url?: string;
    url: string;
    release_date_for_display?: string;
    stats?: { pageviews?: number };
  };
}

async function searchGenius(title: string, artist: string, token: string) {
  const query = encodeURIComponent(`${title} ${artist}`);
  const resp = await fetch(`${GENIUS_SEARCH_URL}?q=${query}&access_token=${token}`);
  if (!resp.ok) throw new Error(`Genius search failed: ${resp.status}`);

  const data = await resp.json();
  const hits: GeniusSearchHit[] = data.response?.hits ?? [];

  // Find best match by comparing title/artist
  const normalTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, "");

  const match = hits.find((h) => {
    const hTitle = h.result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hArtist = h.result.primary_artist.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return hTitle.includes(normalTitle) || normalTitle.includes(hTitle) ||
           (hArtist.includes(normalArtist) && hTitle.includes(normalTitle.slice(0, 6)));
  }) ?? hits[0]; // fallback to first result

  return match?.result ?? null;
}

interface GeniusSongDetail {
  song: {
    id: number;
    title: string;
    primary_artist: { name: string };
    album?: { name: string };
    release_date_for_display?: string;
    description: { dom?: { children?: unknown[] }; plain?: string };
    song_art_image_url?: string;
    header_image_url?: string;
    url: string;
    writer_artists?: { name: string }[];
    producer_artists?: { name: string }[];
    stats?: { pageviews?: number };
    custom_performances?: { label: string; artists: { name: string }[] }[];
    song_relationships?: { relationship_type: string; songs: { title: string; primary_artist: { name: string } }[] }[];
    media?: { provider: string; url: string }[];
  };
}

async function getGeniusSongDetail(songId: number, token: string): Promise<GeniusSongDetail | null> {
  const resp = await fetch(`${GENIUS_API_BASE}/songs/${songId}?text_format=plain&access_token=${token}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.response ?? null;
}

interface GeniusReferent {
  annotations: {
    id: number;
    body: { plain: string };
  }[];
  range: { content: string };
}

async function getGeniusAnnotations(songId: number, token: string) {
  const resp = await fetch(
    `${GENIUS_API_BASE}/referents?song_id=${songId}&text_format=plain&per_page=20&access_token=${token}`
  );
  if (!resp.ok) return [];

  const data = await resp.json();
  const referents: GeniusReferent[] = data.response?.referents ?? [];

  return referents
    .filter((r) => r.annotations?.length > 0)
    .map((r) => ({
      id: r.annotations[0].id,
      referent: r.range?.content ?? "",
      body: r.annotations[0].body?.plain ?? "",
    }))
    .filter((a) => a.body.length > 0);
}

async function fetchGeniusData(title: string, artist: string) {
  const token = await getGeniusToken();
  if (!token) {
    return { error: "No Genius API token configured. Add one in the extension popup." };
  }

  try {
    const searchResult = await searchGenius(title, artist, token);
    if (!searchResult) return { error: "Song not found on Genius" };

    // Fetch song details and annotations in parallel
    const [detail, annotations] = await Promise.all([
      getGeniusSongDetail(searchResult.id, token),
      getGeniusAnnotations(searchResult.id, token),
    ]);

    const song = detail?.song;
    return {
      geniusData: {
        title: song?.title ?? searchResult.title,
        artist: song?.primary_artist?.name ?? searchResult.primary_artist.name,
        album: song?.album?.name,
        releaseDate: song?.release_date_for_display,
        description: song?.description?.plain ?? "",
        annotations,
        geniusUrl: song?.url ?? searchResult.url,
        albumArt: song?.song_art_image_url ?? searchResult.song_art_image_url,
        songArt: song?.header_image_url ?? searchResult.header_image_url,
        producers: song?.producer_artists?.map((a) => a.name) ?? [],
        writers: song?.writer_artists?.map((a) => a.name) ?? [],
        pageViews: song?.stats?.pageviews,
      },
    };
  } catch (err) {
    console.error("LyricsMind: Genius fetch error", err);
    return { error: "Failed to fetch from Genius" };
  }
}

// ---- LRCLIB (lyrics fallback) ----

async function fetchLRCLIB(title: string, artist: string) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const resp = await fetch(`${LRCLIB_BASE}/search?q=${query}`);
    if (!resp.ok) return null;

    const results = await resp.json();
    if (!results?.length) return null;

    const best = results[0];
    const lyricsData: { syncedLyrics: unknown[] | null; plainLyrics: string | null } = {
      syncedLyrics: null,
      plainLyrics: best.plainLyrics ?? null,
    };

    if (best.syncedLyrics) {
      lyricsData.syncedLyrics = parseLRC(best.syncedLyrics);
    }

    return lyricsData;
  } catch (err) {
    console.error("LyricsMind: LRCLIB fetch error", err);
    return null;
  }
}

function parseLRC(lrcText: string) {
  const lines: { time: number; text: string }[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
  let match;

  while ((match = regex.exec(lrcText)) !== null) {
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const ms = parseInt(match[3].padEnd(3, "0"), 10);
    const text = match[4].trim();
    if (text) {
      lines.push({ time: min * 60000 + sec * 1000 + ms, text });
    }
  }

  return lines.length > 0 ? lines : null;
}

// ---- Message handler ----

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FETCH_SONG_DATA") {
    const { title, artist, platformHasLyrics } = message.payload;
    const cacheKey = `${title}|${artist}`;

    // Check cache
    if (cache.has(cacheKey)) {
      sendResponse(cache.get(cacheKey));
      return true;
    }

    // Always fetch LRCLIB — we need timestamps for annotation time-sync,
    // even when the platform already shows lyrics.
    const promises: [Promise<unknown>, Promise<unknown>] = [
      fetchGeniusData(title, artist),
      fetchLRCLIB(title, artist),
    ];

    Promise.all(promises).then(([geniusResult, lyricsData]) => {
      const result = { ...(geniusResult as Record<string, unknown>), lyricsData };
      cache.set(cacheKey, result as { geniusData: unknown; lyricsData: unknown });
      sendResponse(result);
    });

    return true; // async response
  }

  if (message.type === "GET_GENIUS_TOKEN") {
    getGeniusToken().then((token) => sendResponse({ token }));
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("LyricsMind extension installed");
});

// Note: chrome.action.onClicked doesn't fire when default_popup is set.
// Sidebar toggle is handled via keyboard shortcut (Cmd+Shift+L).

// Keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-sidebar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_SIDEBAR" }).catch(() => {});
      }
    });
  }
});

// LyricsMind - Background Service Worker
// Handles Genius API + LRCLIB fetching, caching, and coordination.

const LRCLIB_BASE = "https://lrclib.net/api";
const GENIUS_API_BASE = "https://api.genius.com";
const GENIUS_SEARCH_URL = "https://api.genius.com/search";

// Simple in-memory cache (persists while service worker is alive)
const cache = new Map<string, { geniusData: unknown; lyricsData: unknown }>();

// ---- Title normalization for live versions, covers, remixes, etc. ----

// Patterns to strip from song titles (order matters — most specific first)
const TITLE_STRIP_PATTERNS = [
  // Parenthesized suffixes
  /\s*\((?:live|en vivo|ao vivo|dal vivo)\s*(?:at|@|in|from|on)?\s*[^)]*\)/gi,
  /\s*\((?:live|en vivo|ao vivo|dal vivo)\s*(?:version|ver\.?|recording)?\)/gi,
  /\s*\((?:acoustic|unplugged|stripped)\s*(?:version|ver\.?|session|live)?\)/gi,
  /\s*\((?:cover|tribute|originally by)\s*[^)]*\)/gi,
  /\s*\((?:remix|re-?mix|mix)\s*[^)]*\)/gi,
  /\s*\((?:demo|rough mix|alternate|alt\.?\s*(?:version|ver\.?|take)?)\)/gi,
  /\s*\((?:remaster(?:ed)?|deluxe|bonus\s*track|extended|radio\s*edit)\s*[^)]*\)/gi,
  /\s*\((?:feat\.?|ft\.?|featuring)\s*[^)]*\)/gi,
  /\s*\((?:\d{4}\s*)?(?:version|ver\.?|edit|mix)\)/gi,
  // Bracketed suffixes
  /\s*\[(?:live|acoustic|unplugged|cover|remix|demo|remaster(?:ed)?|feat\.?|ft\.?)[^\]]*\]/gi,
  // Dash/hyphen suffixes
  /\s*-\s*(?:live|acoustic|unplugged|cover|remix|demo|remaster(?:ed)?)\s*(?:version|ver\.?|recording)?$/gi,
  /\s*-\s*(?:live)\s+(?:at|@|in|from|on)\s+.*$/gi,
];

function normalizeTitle(title: string): { cleaned: string; wasModified: boolean } {
  let cleaned = title;
  for (const pattern of TITLE_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.trim().replace(/\s+/g, " ");
  // Remove trailing dash or colon left over after stripping
  cleaned = cleaned.replace(/\s*[-:]+\s*$/, "").trim();
  return { cleaned, wasModified: cleaned !== title };
}

function normalizeArtist(artist: string): string {
  // Strip "feat./ft." suffixes from artist to get the primary artist
  return artist
    .replace(/\s*(?:feat\.?|ft\.?|featuring|with|&|,)\s+.*/i, "")
    .trim();
}

// ---- Fuzzy verification to detect wrong-song results ----

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(normalizeForMatch(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeForMatch(b).split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return matches / Math.min(wordsA.size, wordsB.size);
}

function verifySongMatch(
  requestedTitle: string,
  requestedArtist: string,
  returnedTitle: string,
  returnedArtist: string,
): boolean {
  const { cleaned: cleanRequested } = normalizeTitle(requestedTitle);
  const titleScore = Math.max(
    wordOverlapScore(requestedTitle, returnedTitle),
    wordOverlapScore(cleanRequested, returnedTitle),
  );
  const artistScore = wordOverlapScore(
    normalizeArtist(requestedArtist),
    returnedArtist,
  );
  if (titleScore >= 0.8) return true;
  if (titleScore >= 0.5 && artistScore >= 0.5) return true;
  console.log(`LyricsMind: Rejecting mismatch — requested "${requestedTitle}" by "${requestedArtist}", got "${returnedTitle}" by "${returnedArtist}" (title=${titleScore.toFixed(2)}, artist=${artistScore.toFixed(2)})`);
  return false;
}

async function getGeniusToken(): Promise<string | null> {
  const result = await chrome.storage.local.get("geniusToken");
  return result.geniusToken ?? null;
}

async function getAIConfig(): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
  const result = await chrome.storage.local.get(["aiApiKey", "aiBaseUrl", "aiModel"]);
  if (!result.aiApiKey) return null;
  return {
    apiKey: result.aiApiKey,
    baseUrl: result.aiBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
    model: result.aiModel || "gemini-2.0-flash",
  };
}

// ---- AI Insights ----

const aiCache = new Map<string, string>();

async function fetchAIInsights(title: string, artist: string): Promise<{ aiInsights?: string; error?: string }> {
  const config = await getAIConfig();
  if (!config) {
    return { error: "No AI API key configured. Add one in the extension popup settings." };
  }

  const { cleaned: normTitle } = normalizeTitle(title);
  const cacheKey = `ai|${normTitle}|${normalizeArtist(artist)}`;
  if (aiCache.has(cacheKey)) {
    return { aiInsights: aiCache.get(cacheKey)! };
  }

  const prompt = `"${normTitle}" by ${artist}.

## Summary — one paragraph on the song's core message.
## Lyric Breakdown — key themes, metaphors, wordplay. Quote lyrics in *italics*.

Include ONLY if well-documented (omit otherwise):
## Inspiration & Background
## Cultural Impact
## Trivia

Cite sources inline: [name](url). Short paragraphs (2-4 sentences), no bullets.`;

  try {
    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are a music critic. Always respond in English. Write engaging, concise paragraph-based analysis using markdown ## headers. Cite sources as [name](url). Omit sections with no real information — brevity is fine. Do not fabricate facts.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("LyricsMind: AI API error", resp.status, errBody);
      return { error: `AI API error (${resp.status}). Check your API key and settings.` };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) return { error: "AI returned an empty response." };

    aiCache.set(cacheKey, content);
    return { aiInsights: content };
  } catch (err) {
    console.error("LyricsMind: AI fetch error", err);
    return { error: "Failed to connect to AI API. Check your base URL and network." };
  }
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

  if (!match) return null;

  // Verify the result actually matches the requested song
  if (!verifySongMatch(title, artist, match.result.title, match.result.primary_artist.name)) {
    return null;
  }

  return match.result;
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
    const { cleaned: cleanTitle, wasModified: titleChanged } = normalizeTitle(title);
    const cleanArtist = normalizeArtist(artist);

    // For live/acoustic/remix versions, search the album version first
    // so we get the richer annotations from the canonical release
    let searchResult: Awaited<ReturnType<typeof searchGenius>> | null = null;
    if (titleChanged) {
      console.log(`LyricsMind: Searching Genius with normalized title: "${cleanTitle}" - "${cleanArtist}"`);
      searchResult = await searchGenius(cleanTitle, cleanArtist, token);
    }

    // Fall back to original title if normalized search found nothing
    if (!searchResult) {
      searchResult = await searchGenius(title, artist, token);
    }

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

async function searchLRCLIB(title: string, artist: string) {
  const query = encodeURIComponent(`${title} ${artist}`);
  const resp = await fetch(`${LRCLIB_BASE}/search?q=${query}`);
  if (!resp.ok) return null;
  const results = await resp.json();
  if (!results?.length) return null;

  // Find the first result that actually matches the requested song
  for (const result of results) {
    const rTitle = result.trackName ?? result.name ?? "";
    const rArtist = result.artistName ?? result.artist ?? "";
    if (verifySongMatch(title, artist, rTitle, rArtist)) {
      return result;
    }
  }

  console.log(`LyricsMind: No LRCLIB result passed verification for "${title}" by "${artist}"`);
  return null;
}

async function fetchLRCLIB(title: string, artist: string) {
  try {
    // Try original title first
    let best = await searchLRCLIB(title, artist);

    // If no result, retry with normalized title
    if (!best) {
      const { cleaned: cleanTitle, wasModified: titleChanged } = normalizeTitle(title);
      const cleanArtist = normalizeArtist(artist);
      const artistChanged = cleanArtist !== artist;

      if (titleChanged || artistChanged) {
        console.log(`LyricsMind: Retrying LRCLIB search with normalized: "${cleanTitle}" - "${cleanArtist}"`);
        best = await searchLRCLIB(cleanTitle, cleanArtist);
      }
    }

    if (!best) return null;

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
    const { title, artist } = message.payload;
    // Cache key uses normalized title so live/acoustic versions share cache
    const { cleaned: normTitle } = normalizeTitle(title);
    const normArtist = normalizeArtist(artist);
    const cacheKey = `${normTitle}|${normArtist}`;

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

  if (message.type === "FETCH_AI_INSIGHTS") {
    const { title, artist } = message.payload;
    fetchAIInsights(title, artist).then((result) => sendResponse(result));
    return true;
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

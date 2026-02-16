// LyricsMind - Message types for communication between extension components

export interface SongInfo {
  title: string;
  artist: string;
  albumArt?: string;
  platformHasLyrics: boolean;
}

export interface GeniusAnnotation {
  id: number;
  referent: string; // the lyric fragment this annotates
  body: string; // annotation text
}

export interface GeniusSongData {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  description: string; // song description/about from Genius
  annotations: GeniusAnnotation[];
  geniusUrl?: string;
  albumArt?: string;
  songArt?: string;
  producers?: string[];
  writers?: string[];
  pageViews?: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  syncedLyrics: LyricLine[] | null;
  plainLyrics: string | null;
}

// Content script -> Background
export type BackgroundMessage =
  | { type: "FETCH_SONG_DATA"; payload: SongInfo }
  | { type: "GET_GENIUS_TOKEN" };

// Background -> Content script
export type ContentMessage = { type: "TOGGLE_SIDEBAR" };

// Content script -> Sidebar iframe (via postMessage)
export type SidebarMessage =
  | { type: "SONG_UPDATE"; payload: SongInfo }
  | { type: "GENIUS_DATA"; payload: GeniusSongData | null; error?: string }
  | { type: "LYRICS_DATA"; payload: LyricsData | null }
  | { type: "PLAYBACK_UPDATE"; payload: { currentTime: number; isPlaying: boolean } }
  | { type: "LOADING"; payload: boolean };

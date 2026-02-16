// LyricsMind - Message types for communication between extension components

export interface SongInfo {
  title: string;
  artist: string;
}

export type MessageType =
  | { type: "FETCH_LYRICS"; payload: SongInfo }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SONG_CHANGED"; payload: SongInfo };

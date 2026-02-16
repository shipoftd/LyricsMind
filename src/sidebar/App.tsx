import { useState } from "react";

export default function App() {
  const [song] = useState<{ title: string; artist: string } | null>(null);

  return (
    <div className="h-screen bg-neutral-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-neutral-700">
        <div className="w-12 h-12 rounded bg-neutral-700 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm font-bold truncate">
            {song?.title ?? "No song playing"}
          </h1>
          <p className="text-xs text-neutral-400 truncate">
            {song?.artist ?? "Play a song to see lyrics"}
          </p>
        </div>
      </header>

      {/* Lyrics area */}
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-neutral-500 text-sm text-center mt-20">
          Lyrics will appear here
        </p>
      </main>

      {/* Footer */}
      <footer className="p-3 border-t border-neutral-700 text-center">
        <span className="text-xs text-neutral-500">LyricsMind v0.1</span>
      </footer>
    </div>
  );
}

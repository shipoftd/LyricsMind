import { useState, useEffect } from "react";

export default function App() {
  const [enabled, setEnabled] = useState(true);
  const [geniusToken, setGeniusToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["enabled", "geniusToken"], (result) => {
      if (result.enabled !== undefined) setEnabled(result.enabled);
      if (result.geniusToken) setGeniusToken(result.geniusToken);
    });
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.set({ enabled: next });
  };

  const handleSaveToken = () => {
    chrome.storage.local.set({ geniusToken: geniusToken.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="w-80 bg-[#0a0a0f] text-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <h1 className="text-base font-bold">LyricsMind</h1>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm text-white/70">Enable sidebar</span>
        <button
          onClick={handleToggle}
          className={`w-10 h-5 rounded-full relative transition-colors ${
            enabled ? "bg-purple-500" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {/* Genius API token */}
      <div className="space-y-2">
        <label className="text-xs text-white/50 block">Genius API Token</label>
        <input
          type="password"
          value={geniusToken}
          onChange={(e) => setGeniusToken(e.target.value)}
          placeholder="Paste your Genius API token"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
        />
        <button
          onClick={handleSaveToken}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
        >
          {saved ? "Saved!" : "Save Token"}
        </button>
        <p className="text-[10px] text-white/30 leading-relaxed">
          Get a free token at{" "}
          <a
            href="https://genius.com/api-clients"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400/70 hover:text-purple-400"
          >
            genius.com/api-clients
          </a>
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="text-[10px] text-white/20">
          Toggle sidebar: Cmd+Shift+L (Mac) / Ctrl+Shift+L (Win)
        </p>
      </div>
    </div>
  );
}

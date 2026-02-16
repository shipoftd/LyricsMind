import { useState, useEffect } from "react";

export default function App() {
  const [enabled, setEnabled] = useState(true);
  const [geniusToken, setGeniusToken] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ["enabled", "geniusToken", "aiApiKey", "aiBaseUrl", "aiModel"],
      (result) => {
        if (result.enabled !== undefined) setEnabled(result.enabled);
        if (result.geniusToken) setGeniusToken(result.geniusToken);
        if (result.aiApiKey) setAiApiKey(result.aiApiKey);
        if (result.aiBaseUrl) setAiBaseUrl(result.aiBaseUrl);
        if (result.aiModel) setAiModel(result.aiModel);
      }
    );
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.set({ enabled: next });
  };

  const handleSave = () => {
    chrome.storage.local.set({
      geniusToken: geniusToken.trim(),
      aiApiKey: aiApiKey.trim(),
      aiBaseUrl: aiBaseUrl.trim(),
      aiModel: aiModel.trim(),
    });
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
      <div className="space-y-2 mb-4">
        <label className="text-xs text-white/50 block">Genius API Token</label>
        <input
          type="password"
          value={geniusToken}
          onChange={(e) => setGeniusToken(e.target.value)}
          placeholder="Paste your Genius API token"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
        />
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

      {/* AI API settings */}
      <div className="space-y-2 mb-4 pt-4 border-t border-white/5">
        <label className="text-xs text-white/50 block">Gemini API Key</label>
        <input
          type="password"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          placeholder="AIza..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
        />
        <p className="text-[10px] text-white/30 leading-relaxed">
          Get a free key at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400/70 hover:text-purple-400"
          >
            aistudio.google.com/apikey
          </a>
        </p>
        <label className="text-xs text-white/50 block">Base URL (optional)</label>
        <input
          type="text"
          value={aiBaseUrl}
          onChange={(e) => setAiBaseUrl(e.target.value)}
          placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
        />
        <label className="text-xs text-white/50 block">Model (optional)</label>
        <input
          type="text"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          placeholder="gemini-2.0-flash"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
        />
        <p className="text-[10px] text-white/30 leading-relaxed">
          Defaults to Google Gemini. Also works with OpenAI or any compatible API.
        </p>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>

      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="text-[10px] text-white/20">
          Toggle sidebar: Cmd+Shift+L (Mac) / Ctrl+Shift+L (Win)
        </p>
      </div>
    </div>
  );
}

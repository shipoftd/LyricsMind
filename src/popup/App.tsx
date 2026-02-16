import { useState, useEffect } from "react";

export default function App() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.local.get("enabled", (result) => {
      if (result.enabled !== undefined) setEnabled(result.enabled);
    });
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.set({ enabled: next });
  };

  return (
    <div className="w-72 bg-neutral-900 text-white p-4">
      <h1 className="text-lg font-bold mb-3">LyricsMind</h1>
      <div className="flex items-center justify-between">
        <span className="text-sm">Enable sidebar</span>
        <button
          onClick={handleToggle}
          className={`w-10 h-5 rounded-full relative transition-colors ${
            enabled ? "bg-green-500" : "bg-neutral-600"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-neutral-500 mt-4">
        Use Alt+L to toggle the sidebar.
      </p>
    </div>
  );
}

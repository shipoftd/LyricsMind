import { useState, useEffect, useRef, useMemo } from "react";

interface SongInfo {
  title: string;
  artist: string;
  albumArt?: string;
  platformHasLyrics: boolean;
}

interface GeniusAnnotation {
  id: number;
  referent: string;
  body: string;
}

interface TimedAnnotation extends GeniusAnnotation {
  time: number; // ms timestamp mapped from synced lyrics
}

interface GeniusSongData {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  description: string;
  annotations: GeniusAnnotation[];
  geniusUrl?: string;
  albumArt?: string;
  songArt?: string;
  producers?: string[];
  writers?: string[];
  pageViews?: number;
}

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsData {
  syncedLyrics: LyricLine[] | null;
  plainLyrics: string | null;
}

type Tab = "context" | "lyrics";

// ---- Fuzzy match annotation referent to a synced lyric line ----
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function matchAnnotationsToTimestamps(
  annotations: GeniusAnnotation[],
  syncedLyrics: LyricLine[] | null
): TimedAnnotation[] {
  if (!syncedLyrics || syncedLyrics.length === 0) {
    // No timing data — spread evenly across a 4-min song as fallback
    const totalMs = 240000;
    const interval = totalMs / (annotations.length + 1);
    return annotations.map((ann, i) => ({ ...ann, time: interval * (i + 1) }));
  }

  return annotations.map((ann) => {
    const normRef = normalize(ann.referent);
    if (!normRef) {
      // No referent text — assign to middle of song
      const mid = syncedLyrics[Math.floor(syncedLyrics.length / 2)];
      return { ...ann, time: mid.time };
    }

    // Find the lyric line with the best overlap
    let bestIdx = 0;
    let bestScore = 0;

    for (let i = 0; i < syncedLyrics.length; i++) {
      const normLine = normalize(syncedLyrics[i].text);
      // Check if the referent appears in this line or a window of consecutive lines
      const window = [normLine];
      if (i + 1 < syncedLyrics.length) window.push(normalize(syncedLyrics[i + 1].text));
      if (i + 2 < syncedLyrics.length) window.push(normalize(syncedLyrics[i + 2].text));
      const windowText = window.join(" ");

      // Score: longest common substring ratio
      if (windowText.includes(normRef)) {
        // Exact match in window
        if (normRef.length > bestScore) {
          bestScore = normRef.length;
          bestIdx = i;
        }
      } else {
        // Partial: check word overlap
        const refWords = normRef.split(" ");
        const matchCount = refWords.filter((w) => windowText.includes(w)).length;
        const score = matchCount / refWords.length;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    return { ...ann, time: syncedLyrics[bestIdx].time };
  });
}

export default function App() {
  const [song, setSong] = useState<SongInfo | null>(null);
  const [genius, setGenius] = useState<GeniusSongData | null>(null);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("context");
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) return;

      switch (msg.type) {
        case "SONG_UPDATE":
          setSong(msg.payload);
          setGenius(null);
          setLyrics(null);
          setError(null);
          setExpandedAnnotations(new Set());
          setDescriptionExpanded(false);
          setActiveTab("context");
          setShowAll(false);
          break;
        case "GENIUS_DATA":
          setGenius(msg.payload);
          if (msg.error) setError(msg.error);
          break;
        case "LYRICS_DATA":
          setLyrics(msg.payload);
          break;
        case "PLAYBACK_UPDATE":
          setCurrentTime(msg.payload.currentTime);
          break;
        case "LOADING":
          setLoading(msg.payload);
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const toggleAnnotation = (id: number) => {
    setExpandedAnnotations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build timed annotations whenever genius data or lyrics change
  const timedAnnotations = useMemo(() => {
    if (!genius?.annotations?.length) return [];
    return matchAnnotationsToTimestamps(genius.annotations, lyrics?.syncedLyrics ?? null)
      .sort((a, b) => a.time - b.time);
  }, [genius, lyrics]);

  const showLyricsTab = song && !song.platformHasLyrics && lyrics;
  const albumArt = genius?.albumArt ?? genius?.songArt ?? song?.albumArt;

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden font-sans">
      {/* Animations CSS */}
      <style>{`
        @keyframes annotationIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .annotation-enter {
          animation: annotationIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .annotation-collapsed {
          max-height: 80px;
          overflow: hidden;
          mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
        }
        .annotation-active {
          border-color: rgba(168, 85, 247, 0.3) !important;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.08);
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(168, 85, 247, 0.05); }
          50% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.15); }
        }
        .annotation-latest {
          animation: annotationIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     pulseGlow 2s ease-in-out 0.4s 2;
        }
      `}</style>

      {/* Header */}
      <header className="flex items-center gap-3 p-4 bg-[#111118] border-b border-white/10 flex-shrink-0">
        {albumArt ? (
          <img
            src={albumArt}
            alt="Album art"
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 shadow-lg"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex-shrink-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-white/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold truncate leading-tight">
            {song?.title ?? "No song playing"}
          </h1>
          <p className="text-xs text-white/50 truncate">
            {song?.artist ?? "Play a song on YouTube Music or Spotify"}
          </p>
          {genius?.album && (
            <p className="text-[10px] text-white/30 truncate mt-0.5">
              {genius.album}
              {genius.releaseDate ? ` \u00b7 ${genius.releaseDate}` : ""}
            </p>
          )}
        </div>
        {genius?.geniusUrl && (
          <a
            href={genius.geniusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-yellow-400/70 hover:text-yellow-400 flex-shrink-0 px-2 py-1 rounded border border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
          >
            Genius
          </a>
        )}
      </header>

      {/* Tab bar (only show if lyrics available for display) */}
      {showLyricsTab && (
        <div className="flex border-b border-white/10 bg-[#111118] flex-shrink-0">
          <button
            onClick={() => setActiveTab("context")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === "context"
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Context & Annotations
          </button>
          <button
            onClick={() => setActiveTab("lyrics")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === "lyrics"
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Lyrics
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-xs text-white/40">Fetching annotations...</p>
          </div>
        )}

        {!loading && error && !genius && (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <p className="text-sm text-white/60 mb-1">{error}</p>
            {error.includes("token") && (
              <p className="text-xs text-white/30 mt-2">
                Click the LyricsMind icon in your toolbar to add your Genius API token.
              </p>
            )}
          </div>
        )}

        {!loading && !error && !song && (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-400/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <p className="text-sm text-white/40 text-center">
              Play a song to see annotations & context
            </p>
          </div>
        )}

        {!loading && genius && activeTab === "context" && (
          <ContextView
            genius={genius}
            timedAnnotations={timedAnnotations}
            currentTime={currentTime}
            showAll={showAll}
            setShowAll={setShowAll}
            descriptionExpanded={descriptionExpanded}
            setDescriptionExpanded={setDescriptionExpanded}
            expandedAnnotations={expandedAnnotations}
            toggleAnnotation={toggleAnnotation}
          />
        )}

        {!loading && activeTab === "lyrics" && lyrics && (
          <LyricsView lyrics={lyrics} currentTime={currentTime} />
        )}
      </main>

      {/* Footer */}
      <footer className="p-2 border-t border-white/5 text-center flex-shrink-0 bg-[#0a0a0f]">
        <span className="text-[10px] text-white/20">LyricsMind v0.1</span>
      </footer>
    </div>
  );
}

// ---- Context & Annotations View ----

function ContextView({
  genius,
  timedAnnotations,
  currentTime,
  showAll,
  setShowAll,
  descriptionExpanded,
  setDescriptionExpanded,
  expandedAnnotations,
  toggleAnnotation,
}: {
  genius: GeniusSongData;
  timedAnnotations: TimedAnnotation[];
  currentTime: number;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  descriptionExpanded: boolean;
  setDescriptionExpanded: (v: boolean) => void;
  expandedAnnotations: Set<number>;
  toggleAnnotation: (id: number) => void;
}) {
  const descriptionTruncated =
    genius.description.length > 200 && !descriptionExpanded;

  // Determine which annotations are visible based on time
  const visibleAnnotations = showAll
    ? timedAnnotations
    : timedAnnotations.filter((a) => a.time <= currentTime);

  // The most recently revealed annotation
  const latestId = visibleAnnotations.length > 0
    ? visibleAnnotations[visibleAnnotations.length - 1].id
    : null;

  const hiddenCount = timedAnnotations.length - visibleAnnotations.length;

  // Auto-scroll to latest annotation
  const latestRef = useRef<HTMLDivElement>(null);
  const prevLatestId = useRef<number | null>(null);

  useEffect(() => {
    if (latestId !== null && latestId !== prevLatestId.current && latestRef.current) {
      latestRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    prevLatestId.current = latestId;
  }, [latestId]);

  return (
    <div className="p-4 space-y-4">
      {/* Song metadata badges */}
      <div className="flex flex-wrap gap-1.5">
        {(genius.producers?.length ?? 0) > 0 && (
          <MetaBadge label="Produced by" value={genius.producers!.join(", ")} />
        )}
        {(genius.writers?.length ?? 0) > 0 && (
          <MetaBadge label="Written by" value={genius.writers!.join(", ")} />
        )}
        {genius.pageViews && (
          <MetaBadge
            label="Views"
            value={genius.pageViews > 1000000
              ? `${(genius.pageViews / 1000000).toFixed(1)}M`
              : genius.pageViews > 1000
                ? `${(genius.pageViews / 1000).toFixed(0)}K`
                : genius.pageViews.toString()}
          />
        )}
      </div>

      {/* Description / About */}
      {genius.description && genius.description !== "?" && (
        <section>
          <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
            About
          </h2>
          <div className="text-sm text-white/70 leading-relaxed bg-white/5 rounded-lg p-3">
            {descriptionTruncated
              ? genius.description.slice(0, 200) + "..."
              : genius.description}
            {genius.description.length > 200 && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="ml-1 text-purple-400 hover:text-purple-300 text-xs"
              >
                {descriptionExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Annotations */}
      {timedAnnotations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              Annotations
              <span className="text-white/30 normal-case ml-1">
                {visibleAnnotations.length}/{timedAnnotations.length}
              </span>
            </h2>
            <button
              onClick={() => setShowAll(!showAll)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                showAll
                  ? "text-purple-400 border-purple-400/30 bg-purple-400/10"
                  : "text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
              }`}
            >
              {showAll ? "Time-sync" : "Show all"}
            </button>
          </div>

          <div className="space-y-2">
            {visibleAnnotations.map((ann, idx) => {
              const isLatest = ann.id === latestId && !showAll;
              const isOlder = !isLatest && !showAll && visibleAnnotations.length > 1 && idx < visibleAnnotations.length - 1;

              return (
                <div
                  key={ann.id}
                  ref={isLatest ? latestRef : undefined}
                  className={isLatest && !showAll ? "annotation-latest" : "annotation-enter"}
                >
                  <AnnotationCard
                    annotation={ann}
                    expanded={expandedAnnotations.has(ann.id)}
                    onToggle={() => toggleAnnotation(ann.id)}
                    isLatest={isLatest}
                    autoCollapse={isOlder && !expandedAnnotations.has(ann.id)}
                  />
                </div>
              );
            })}
          </div>

          {/* Upcoming hint */}
          {!showAll && hiddenCount > 0 && (
            <div className="mt-3 text-center">
              <p className="text-[10px] text-white/20">
                {hiddenCount} more annotation{hiddenCount > 1 ? "s" : ""} will appear as the song plays...
              </p>
            </div>
          )}
        </section>
      )}

      {timedAnnotations.length === 0 && (!genius.description || genius.description === "?") && (
        <div className="text-center py-8">
          <p className="text-sm text-white/40">
            No annotations available for this song yet.
          </p>
          {genius.geniusUrl && (
            <a
              href={genius.geniusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block"
            >
              View on Genius &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-full px-2.5 py-1 text-[10px] text-white/50 max-w-full truncate">
      <span className="text-white/30">{label}:</span>{" "}
      <span className="text-white/60">{value}</span>
    </div>
  );
}

function AnnotationCard({
  annotation,
  expanded,
  onToggle,
  isLatest,
  autoCollapse,
}: {
  annotation: TimedAnnotation;
  expanded: boolean;
  onToggle: () => void;
  isLatest: boolean;
  autoCollapse: boolean;
}) {
  const shouldCollapse = autoCollapse && !expanded;
  const bodyPreview = annotation.body.length > 120 && !expanded && !shouldCollapse
    ? annotation.body.slice(0, 120) + "..."
    : annotation.body;

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-lg p-3 transition-all duration-300 border ${
        isLatest
          ? "bg-white/[0.05] border-purple-500/30 annotation-active"
          : "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]"
      }`}
    >
      {annotation.referent && (
        <p className={`text-xs italic mb-1.5 leading-snug border-l-2 pl-2 transition-colors duration-300 ${
          isLatest
            ? "text-yellow-400 border-yellow-400/50"
            : "text-yellow-400/60 border-yellow-400/20"
        }`}>
          &ldquo;{annotation.referent}&rdquo;
        </p>
      )}
      <div className={shouldCollapse ? "annotation-collapsed" : ""}>
        <p className={`text-xs leading-relaxed whitespace-pre-line transition-colors duration-300 ${
          isLatest ? "text-white/80" : "text-white/50"
        }`}>
          {shouldCollapse ? annotation.body : bodyPreview}
        </p>
      </div>
      {(annotation.body.length > 120 || shouldCollapse) && (
        <span className="text-[10px] text-purple-400 mt-1 inline-block">
          {expanded ? "Show less" : "Show more"}
        </span>
      )}
    </button>
  );
}

// ---- Lyrics View (only shown when platform doesn't have lyrics) ----

function LyricsView({ lyrics, currentTime }: { lyrics: LyricsData; currentTime: number }) {
  if (lyrics.syncedLyrics) {
    let activeIdx = 0;
    for (let i = 0; i < lyrics.syncedLyrics.length; i++) {
      if (lyrics.syncedLyrics[i].time <= currentTime) activeIdx = i;
      else break;
    }

    return (
      <div className="p-4 space-y-1">
        {lyrics.syncedLyrics.map((line, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed transition-all duration-300 ${
              i === activeIdx
                ? "text-white font-semibold scale-[1.02] origin-left"
                : i < activeIdx
                  ? "text-white/25"
                  : "text-white/45"
            }`}
          >
            {line.text}
          </p>
        ))}
      </div>
    );
  }

  if (lyrics.plainLyrics) {
    return (
      <div className="p-4">
        <pre className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap font-sans">
          {lyrics.plainLyrics}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <p className="text-sm text-white/40">No lyrics found</p>
    </div>
  );
}

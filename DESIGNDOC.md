# LyricsMind: Smart Lyrics & Annotations Extension

*A Chrome Extension for YouTube Music & Spotify*

---

## Project Description

LyricsMind is a Chrome browser extension that enhances the music listening experience on YouTube Music and Spotify by providing synchronized lyrics alongside rich, contextual annotations similar to Genius.com. The extension displays in a non-intrusive sidebar, offering users deeper insight into the songs they're listening to through background information, trivia, artist commentary, and cultural references.

The extension will automatically detect the currently playing song, fetch relevant lyrics and annotations from multiple sources, and present them in a beautiful, time-synchronized interface that enhances rather than disrupts the listening experience.

---

## Project Milestones

### Milestone 1: Proof of Concept - Static Display

**Goal:** Establish core functionality with basic static lyrics and annotation display

**Key Deliverables:**

- Chrome extension manifest and basic structure
- Content script that detects currently playing song on YouTube Music and/or Spotify web player
- Sidebar UI that displays when music is playing
- Integration with at least one lyrics API (Genius or Musixmatch)
- Display of complete static lyrics in the sidebar
- Display of 2-3 static annotations per song (pulled from Genius API if available)

**Success Criteria:** Extension successfully identifies songs and displays lyrics with basic annotations in a functional sidebar on both YouTube Music and Spotify.

---

### Milestone 2: Time-Synchronized Display

**Goal:** Implement real-time synchronization of lyrics and annotations with music playback

**Key Deliverables:**

- Integration with time-synced lyrics sources (LRC format from multiple providers)
- Real-time playback position tracking from the music player
- Auto-scrolling lyrics that highlight the current line being sung
- Time-stamped annotation display that appears at relevant moments in the song
- Smooth animation and transition effects for lyric/annotation changes

**Success Criteria:** Lyrics highlight in real-time with music playback accuracy within 200ms, and annotations appear contextually at the right moments in the song.

---

### Milestone 3: Interactive Features & Rich Content

**Goal:** Add interactive elements and expand annotation sources for richer context

**Key Deliverables:**

- Clickable lyric lines that seek to that timestamp in the song
- Expandable annotations with source attribution and 'Read More' links
- Integration with multiple annotation sources (Genius, Wikipedia, artist interviews, music blogs)
- Referenced sources as clickable links that open in new tabs
- User preference settings (annotation density, auto-scroll speed, sidebar position)
- Keyboard shortcuts for sidebar toggle and navigation

**Success Criteria:** Users can interact with lyrics to control playback, explore annotations from multiple verified sources, and customize their experience through settings.

---

### Milestone 4: Contextual Information & Trivia

**Goal:** Provide comprehensive song context including production details, trivia, and cultural impact

**Key Deliverables:**

- Song metadata display (release date, album, producers, writers, genre)
- Chart performance and popularity statistics
- Cultural impact and historical context sections
- Sample/interpolation detection with links to original songs
- Artist relationship maps (collaborators, featured artists, influences)
- Time-synced trivia cards that appear at specific moments (e.g., 'This sample is from...' when the sample plays)

**Success Criteria:** Extension provides comprehensive song context that educates users about the music they're listening to, with time-synchronized trivia enhancing specific moments in the song.

---

### Milestone 5: Advanced Features (Stretch Goals)

**Goal:** Implement advanced features that set the extension apart from competitors

**Potential Features:**

- **AI-Powered Insights:** Use LLMs to generate lyric interpretations, identify literary devices, and explain metaphors in real-time
- **Multi-Language Support:** Real-time translation of lyrics with cultural context for non-English songs
- **Community Features:** Allow users to submit and vote on annotations, creating a crowd-sourced knowledge base
- **Visual Enhancements:** Album art integration, color themes that match the album aesthetic, animated backgrounds
- **Export & Sharing:** Allow users to export annotated lyrics as PDF or share specific annotations on social media
- **Cross-Platform Sync:** Sync user preferences and saved annotations across devices
- **Mini-Player Mode:** Detachable sidebar that can float over other applications for system-wide lyrics display

**Success Criteria:** Implementation of at least 2-3 stretch features that significantly enhance user experience and differentiate the extension in the marketplace.

---

## Implementation Details

### Detecting Currently Playing Songs

The extension needs to identify the currently playing song from the web player interface. This is accomplished through DOM scraping using content scripts that run on the music streaming sites.

#### YouTube Music Detection:

- **DOM Element Selection:** Use CSS selectors to target the player bar elements. Song title is typically found at `.title.ytmusic-player-bar` and artist at `.byline.ytmusic-player-bar`
- **Change Detection:** Implement MutationObserver to monitor the player bar for changes. When the title element's text content changes, extract the new song information
- **Playback Position:** Access the time display elements or use the progress bar's aria attributes to determine current playback position for time-sync features
- **Example Implementation:** Monitor `ytmusic-player-bar` container with MutationObserver, extract textContent from title/artist elements, poll time display every 100-200ms for sync accuracy

#### Spotify Web Player Detection:

- **DOM Element Selection:** Target Spotify's now-playing bar. Song information is typically in `[data-testid="now-playing-widget"]` with separate elements for track name and artist
- **Change Detection:** Similar MutationObserver approach, watching the now-playing widget for updates
- **Playback Position:** Spotify provides playback controls with time information. Monitor the progress bar element or time display for current position
- **Alternative Approach:** For more reliable data, consider intercepting Spotify's internal API calls. The web player makes requests to Spotify's endpoints with playback state information that includes precise timing and track metadata

#### Reference Implementation:

The [Web Scrobbler extension](https://github.com/web-scrobbler/web-scrobbler) successfully detects currently playing songs on 200+ music sites including YouTube Music and Spotify. Review their connector implementations for robust DOM scraping patterns

#### Error Handling Strategies:

- **Selector Validation:** Since streaming services frequently update their UI, implement a fallback mechanism that tries multiple known selector patterns
- **Page URL Detection:** Verify the extension is on the correct page (music.youtube.com/watch or open.spotify.com) before attempting to extract song info
- **Debouncing:** Implement debouncing (200-300ms delay) to prevent excessive API calls when users skip through songs quickly

---

### Lyrics Sources & APIs

Multiple lyrics sources should be integrated to maximize coverage and provide fallback options when primary sources fail.

#### Official APIs:

- **Genius API:** The official Genius API provides access to song lyrics and annotations. Registration required for API token at [docs.genius.com](https://docs.genius.com). The API provides song metadata, lyrics, and user-submitted annotations with source attribution. Free tier has rate limits (typically 1000 requests/day). **Best for:** Comprehensive annotations, verified artist commentary, cultural context

- **Musixmatch API:** Commercial API with licensing from publishers. Requires API key from [developer.musixmatch.com](https://developer.musixmatch.com). Provides both static and time-synced lyrics (LRC format). Free tier very limited (500 requests/day). Paid tiers expensive but offer legal, licensed lyrics. **Best for:** Time-synced lyrics, legal compliance, multilingual support

#### Reverse-Engineered Internal APIs:

- **Spotify Internal Lyrics API:** Spotify's web/mobile apps use an internal API endpoint for lyrics. Can be accessed by mimicking the app's requests with proper authentication cookies (sp_dc). Projects like [spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api) and [spotify-lyrics-scraper](https://pypi.org/project/spotify-lyrics-scraper/) demonstrate this approach. Provides time-synced lyrics powered by Musixmatch. **Risks:** Against Spotify TOS, may break with updates, requires user cookies

- **YouTube Music Internal API:** Similar to Spotify, YouTube Music uses Google's InnerTube API (youtubei/v1 endpoints) for lyrics. The [ytmusicapi](https://github.com/sigma67/ytmusicapi) Python library demonstrates accessing this. Requires cookies from authenticated session. Provides lyrics data that YouTube Music displays natively. **Risks:** Unofficial, no guarantees of stability

#### Community & Aggregator Services:

- **LRCLIB API:** Free, open-source lyrics database with time-synced LRC files. No authentication required. Community-maintained with growing coverage. API at [lrclib.net](https://lrclib.net) provides simple REST endpoints. **Best for:** Free time-synced lyrics, no rate limits, open-source friendly

- **Lyrics.ovh:** Aggregator API that pulls from multiple sources. Simple REST API at [lyricsovh.docs.apiary.io](https://lyricsovh.docs.apiary.io) with no authentication needed. Free but has rate limits. Good for basic lyrics when other sources fail

#### Recommended Implementation Strategy:

- **Primary Source:** Start with Genius API for annotations and rich content. It's official, stable, and provides the contextual information that makes the extension valuable
- **Time-Sync Source:** Use LRCLIB or a combination of Spotify/YouTube Music internal APIs (with user consent) for time-synced lyrics. LRCLIB is safer from a TOS perspective
- **Fallback Chain:** Implement a waterfall approach: Try Genius → Try LRCLIB → Try platform's internal API → Try Lyrics.ovh. This maximizes hit rate while respecting rate limits
- **Caching:** Cache lyrics and annotations locally (IndexedDB) to reduce API calls, improve response time, and work offline. Clear cache periodically or when user preferences change

---

### Time-Synchronization Implementation

Achieving accurate time-synchronization requires obtaining timestamped lyrics (LRC format) and continuously matching playback position with lyric timestamps.

#### LRC Format Understanding:

- **Format Structure:** LRC files contain timestamps in [mm:ss.xx] format followed by lyric text. Example: `[00:12.50]Is this the real life? [00:16.73]Is this just fantasy?`
- **Parsing:** Parse LRC data into an array of objects with startTime (milliseconds) and text properties. Sort by startTime to ensure proper ordering
- **Enhanced LRC:** Some sources provide word-level sync (Musixmatch Enhanced LRC) with multiple timestamps per line. This enables karaoke-style word highlighting

#### Playback Position Tracking:

- **Polling Approach:** Query the music player's current time every 100-200ms using setInterval. Extract time from DOM elements (progress bar aria-valuenow, time display text). Convert to milliseconds for comparison with LRC timestamps
- **Event-Based Approach:** Listen for HTML5 audio/video 'timeupdate' events if the player exposes them. More efficient than polling but may not be available on all platforms. Combine with MutationObserver on time display elements as fallback
- **Pause Detection:** Monitor for playback state changes (playing/paused) to stop sync updates when paused. Detect by watching play/pause button state or comparing consecutive time readings

#### Synchronization Algorithm:

- **Binary Search:** Use binary search on sorted LRC array to find the current lyric line based on playback time. O(log n) efficiency for large lyric sets
- **Look-Ahead Buffer:** Pre-highlight the next line 200-300ms before it starts for smooth transitions. Helps compensate for rendering delays and improves perceived accuracy
- **Offset Calibration:** Allow users to adjust sync offset (±2 seconds) to compensate for audio/display latency variations. Store per-platform or global offset preference

#### UI Synchronization Effects:

- **Auto-Scroll:** Smoothly scroll the lyrics container to keep current line in view. Use CSS scroll-behavior: smooth or JavaScript scrollIntoView with smooth behavior. Keep current line at ~30% from top for better reading context
- **Highlighting:** Apply distinct styling to current line (bold, color change, larger font). Dim previous/upcoming lines for visual hierarchy. Use CSS transitions for smooth highlight changes
- **Annotation Timing:** Trigger annotation displays based on associated lyric line timing. Fade in annotations 500ms after their corresponding line starts. Auto-hide after 5-8 seconds or when next annotation appears

---

### User Interface Design & Implementation

The extension's UI should be both visually appealing and functionally efficient, seamlessly integrating with the music streaming platforms while maintaining its own distinct identity.

#### Sidebar Integration:

- **Injection Method:** Use content script to inject a sidebar div into the page DOM. Position as fixed overlay with high z-index (9999+) to stay above page content. Implement as iframe for style isolation (prevents platform CSS conflicts)
- **Positioning Options:** Right sidebar (default): 320-400px width, full viewport height. Left sidebar: Alternative for left-handed users or personal preference. Floating/detachable: Draggable window that can be positioned anywhere. User preference saved in chrome.storage.local
- **Responsive Behavior:** Auto-collapse to icon-only mode on narrow screens (<1200px). Provide toggle button to show/hide sidebar (keyboard shortcut: Alt+L). Smooth slide-in/slide-out animations (300ms duration)

#### Visual Design Framework:

- **Modern UI Library:** Consider using [React](https://react.dev) with [Tailwind CSS](https://tailwindcss.com) for rapid development and responsive design. Alternative: Vue.js with custom CSS for lighter bundle size. Use Shadow DOM for complete style encapsulation from host page
- **Color Scheme:** Dark mode default (matches music platforms). Optional light mode toggle. Dynamic accent colors that adapt to album art (extract dominant colors). Semi-transparent background (backdrop-filter: blur) for modern glass morphism effect
- **Typography:** Sans-serif fonts for readability (Inter, SF Pro, or Roboto). Lyrics: 16-18px, line-height 1.6 for comfortable reading. Annotations: 14-15px, slightly lighter color. Dynamic font sizing option for accessibility

#### Component Structure:

- **Header Section:** Song title and artist (bold, 18-20px). Album art thumbnail (80x80px, rounded corners). Quick action buttons (collapse, settings, refresh)
- **Lyrics Panel (Primary):** Scrollable container with smooth scrolling. Each lyric line as clickable element. Current line highlighted with color/weight change. Line numbers or timestamps optionally visible
- **Annotations Pane:** Floating cards or inline expandable sections. Triggered by lyric line highlighting or manual clicks. Source attribution with icon/logo. Fade-in/fade-out animations for contextual display
- **Trivia/Info Section (Collapsible):** Accordion-style expandable sections. Song credits, chart performance, cultural context. Related songs and samples as clickable links

#### Interactive Features:

- **Lyric Click-to-Seek:** Clicking a lyric line sends timestamp to music player. Requires detecting player controls and simulating seek action. Fallback: Update progress bar position directly if exposed in DOM
- **Copy Functionality:** Right-click context menu for copying lyrics. Copy single line, full lyrics, or lyrics with annotations. Formatted for sharing (include song/artist attribution)
- **Search & Navigate:** In-sidebar search box to jump to specific lyrics. Keyboard navigation (arrow keys to move between lines). Jump-to-timestamp feature for quick navigation

#### Animation & Transitions:

- **Micro-Interactions:** Subtle hover effects on clickable elements (scale, color change). Ripple effect on lyric line clicks. Smooth color transitions for highlight changes
- **Loading States:** Skeleton screens while fetching lyrics. Animated spinner for API requests. Error states with retry button and helpful messages
- **Performance Optimization:** Virtual scrolling for very long lyrics (1000+ lines). Debounced scroll events to reduce repaints. CSS transforms for smooth animations (will-change property)

#### Accessibility Considerations:

- **ARIA Labels:** Proper role and aria-label attributes for screen readers. Announce current lyric line changes. Keyboard-navigable with focus indicators
- **Contrast Ratios:** WCAG AA compliance (4.5:1 for text). High contrast mode option for better readability. Adjustable font sizes (user preference)
- **Reduced Motion:** Respect prefers-reduced-motion media query. Disable animations for users with motion sensitivity. Instant scrolling option instead of smooth scroll

---

### Technical Architecture & File Structure

A well-organized codebase will facilitate easier maintenance, testing, and feature additions throughout development.

#### Chrome Extension Structure:

- **manifest.json:** Manifest V3 format (required for new extensions - see [Chrome Extension docs](https://developer.chrome.com/docs/extensions/mv3/intro/)). Declare content scripts for music.youtube.com and open.spotify.com. Specify permissions: storage, activeTab. Optional: declarativeNetRequest for API optimization
- **Background Service Worker:** Handles API requests to avoid CORS issues. Manages chrome.storage operations. Coordinates between content scripts and popup. Implements caching layer for lyrics/annotations
- **Content Scripts:** Platform-specific scripts (youtube-music.js, spotify.js). DOM manipulation for song detection and sidebar injection. Message passing with background worker. Isolated execution context for security
- **Popup Interface:** Settings panel accessed via extension icon. User preferences configuration. Quick toggle for enable/disable. About/Help documentation links

#### Recommended Folder Structure:

- `/src`
  - `/background` - Service worker code
  - `/content` - Platform-specific content scripts
  - `/sidebar` - React/Vue sidebar application
  - `/popup` - Settings UI
  - `/utils` - Shared utilities (API clients, parsers, helpers)
  - `/styles` - Global CSS/Tailwind configuration

#### Development Tooling:

- **Build System:** Webpack or Vite for bundling React/Vue code. Separate build outputs for content scripts, background, and sidebar. Hot reload during development for faster iteration
- **TypeScript:** Strongly recommended for type safety and better IDE support. Reduces runtime errors in production. Excellent for API response typing
- **Testing:** Jest for unit tests on utility functions. Playwright or Puppeteer for E2E testing on actual music platforms. Mock API responses for reliable testing
- **Version Control:** Git with semantic versioning. Separate branches for features and platforms. CI/CD pipeline for automated testing and builds

---

### Data Flow & State Management

Understanding the data flow from song detection through API fetching to UI display is crucial for maintaining a responsive, bug-free extension.

#### Typical Request Flow:

1. **Song Detection:** Content script observes DOM changes, extracts song title and artist
2. **Cache Check:** Query local IndexedDB cache for existing lyrics/annotations using song+artist as key
3. **API Request (if cache miss):** Send message to background worker with song metadata
4. **Background Processing:** Background worker queries Genius API for annotations, LRCLIB for time-synced lyrics, additional sources as fallback
5. **Data Aggregation:** Combine responses, format into unified data structure, store in cache
6. **UI Update:** Send processed data back to content script via message passing
7. **Sidebar Render:** Content script injects/updates sidebar UI with new lyrics and annotations

#### State Management Approach:

- **Simple React State:** For POC and early milestones, useState and useContext sufficient. currentSong, lyrics, annotations, and playbackPosition as main state variables
- **Redux/Zustand (Advanced):** For complex features (Milestone 4+) where state becomes harder to manage. Centralized store for user preferences, cache, and UI state. Time-travel debugging capabilities
- **Reactive Updates:** Use WebSocket or long-polling for live annotation updates (stretch goal). Message passing between background and content scripts for real-time sync. Event-driven architecture for playback state changes

**Performance Optimization:** Debounce rapid song changes to prevent API spam. Prefetch lyrics for next song in queue when possible. Lazy load annotations (load on-demand rather than all upfront). Virtual DOM optimization for large lyric sets

---

## Success Metrics & Next Steps

**Key Performance Indicators:** Track lyric synchronization accuracy (<200ms deviation), annotation fetch success rate (>90%), sidebar load time (<500ms), API rate limit compliance, user satisfaction through feedback and ratings

**Development Timeline Estimate:** Milestone 1 (POC): 2-3 weeks. Milestone 2 (Time-sync): 2-3 weeks. Milestone 3 (Interactive): 2-3 weeks. Milestone 4 (Trivia): 2-3 weeks. Milestone 5 (Stretch): 3-4 weeks. Total estimated: 11-16 weeks for full implementation

**Recommended First Steps:** Begin with Milestone 1 focusing on YouTube Music support only (simpler DOM structure than Spotify). Build basic sidebar UI with static lyrics from Genius API. Validate the concept works before investing in time-sync complexity. Gather user feedback early to refine UI/UX before adding advanced features. For inspiration and technical reference, review the [Better Lyrics extension](https://github.com/better-lyrics/better-lyrics) which implements similar time-synced functionality for YouTube Music.
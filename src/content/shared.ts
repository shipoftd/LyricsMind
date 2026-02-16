// LyricsMind - Shared content script utilities
// Common sidebar injection and toggle logic used by all platform content scripts.

const SIDEBAR_ID = "lyricsmind-sidebar";
const SIDEBAR_WIDTH = "380px";

export function injectSidebar() {
  if (document.getElementById(SIDEBAR_ID)) return;

  const container = document.createElement("div");
  container.id = SIDEBAR_ID;
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${SIDEBAR_WIDTH};
    height: 100vh;
    z-index: 99999;
    border: none;
    transition: transform 0.3s ease;
    transform: translateX(0);
  `;

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  container.appendChild(iframe);
  document.body.appendChild(container);
}

export function toggleSidebar() {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    injectSidebar();
    return;
  }

  const isHidden = sidebar.style.transform === "translateX(100%)";
  sidebar.style.transform = isHidden ? "translateX(0)" : "translateX(100%)";
}

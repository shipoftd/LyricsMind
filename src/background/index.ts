// LyricsMind - Background Service Worker
// Handles API requests, caching, and coordination between content scripts and popup.

chrome.runtime.onInstalled.addListener(() => {
  console.log("LyricsMind extension installed");
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FETCH_LYRICS") {
    // TODO: Implement lyrics fetching from APIs
    console.log("Lyrics requested for:", message.payload);
    sendResponse({ status: "not_implemented" });
  }

  // Return true to indicate async response
  return true;
});

// Toggle sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" }).catch(() => {});
  }
});

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-sidebar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_SIDEBAR" }).catch(() => {});
      }
    });
  }
});

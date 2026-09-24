import { toHeaderMap } from "./infrastructure/detect";
import { dropCapture, saveCapture } from "./shared/capture";

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId < 0) return;
    void saveCapture(details.tabId, {
      url: details.url,
      statusCode: details.statusCode,
      ip: details.ip ?? null,
      fromCache: details.fromCache,
      headers: toHeaderMap(details.responseHeaders ?? []),
      capturedAt: Date.now(),
    });
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
  ["responseHeaders"],
);

chrome.tabs.onRemoved.addListener((tabId) => {
  void dropCapture(tabId);
});

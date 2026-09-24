import type { HeaderMap } from "../infrastructure/detect";

export interface Capture {
  url: string;
  statusCode: number;
  ip: string | null;
  fromCache: boolean;
  headers: HeaderMap;
  capturedAt: number;
}

const key = (tabId: number) => `capture:${tabId}`;

export async function saveCapture(tabId: number, capture: Capture): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: capture });
}

export async function loadCapture(tabId: number): Promise<Capture | null> {
  const stored = await chrome.storage.session.get(key(tabId));
  return (stored[key(tabId)] as Capture | undefined) ?? null;
}

export async function dropCapture(tabId: number): Promise<void> {
  await chrome.storage.session.remove(key(tabId));
}

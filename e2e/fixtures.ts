import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { type BrowserContext, type Page, test as base, chromium, expect } from "@playwright/test";

const EXTENSION_DIR = path.resolve(import.meta.dirname, "../dist");

type DohAnswer = { name: string; type: number; TTL: number; data: string };
export type DohFixture = Record<string, { Status: number; Answer?: DohAnswer[]; Authority?: DohAnswer[] }>;

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  site: (headers: Record<string, string>) => Promise<string>;
  rdapRequests: string[];
  mockLookups: (doh: DohFixture | "fail", rdap?: object) => Promise<void>;
  openPanel: (tabUrl: string) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: process.env.CHROMIUM_PATH ? undefined : "chromium",
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    });
    await use(context);
    await context.close();
  },

  // Chrome derives an unpacked extension's id from its path; waiting for the "serviceworker" event instead can hang.
  extensionId: async ({}, use) => {
    const hex = createHash("sha256").update(realpathSync(EXTENSION_DIR)).digest("hex").slice(0, 32);
    await use([...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join(""));
  },

  site: async ({}, use) => {
    const servers: http.Server[] = [];
    await use(async (headers) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", ...headers });
        res.end("<!doctype html><title>fixture</title><h1>fixture</h1>");
      });
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      return `http://localhost:${(server.address() as AddressInfo).port}/`;
    });
    await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  },

  rdapRequests: async ({}, use) => {
    await use([]);
  },

  mockLookups: async ({ context, rdapRequests }, use) => {
    await use(async (doh, rdap = {}) => {
      await context.route("https://cloudflare-dns.com/**", (route) => {
        if (doh === "fail") return route.fulfill({ status: 503, body: "unavailable" });
        const type = new URL(route.request().url()).searchParams.get("type") ?? "";
        return route.fulfill({ contentType: "application/dns-json", body: JSON.stringify(doh[type] ?? { Status: 0 }) });
      });
      await context.route("https://rdap.org/**", (route) => {
        rdapRequests.push(route.request().url());
        return route.fulfill({ contentType: "application/rdap+json", body: JSON.stringify(rdap) });
      });
    });
  },

  openPanel: async ({ context, extensionId }, use) => {
    const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
    await use(async (tabUrl) => {
      const site = await context.newPage();
      let tab: chrome.tabs.Tab = { id: -1, url: tabUrl } as chrome.tabs.Tab;
      if (/^https?:/.test(tabUrl)) {
        await site.goto(tabUrl);
        const probe = await context.newPage();
        await probe.goto(popupUrl);
        // The worker is reported before its webRequest listener exists, so a first load can go unseen; reload until captured.
        await expect
          .poll(async () => {
            const tabs = await probe.evaluate(() => chrome.tabs.query({}));
            const found = tabs.find((t) => t.url === tabUrl);
            if (!found?.id) return false;
            tab = found;
            const stored = await probe.evaluate((id) => chrome.storage.session.get(`capture:${id}`), found.id);
            if ((stored[`capture:${found.id}`] as { url?: string } | undefined)?.url === tabUrl) return true;
            await site.reload();
            return false;
          })
          .toBe(true);
        await probe.close();
      }

      // The real popup reads the active tab; opened as a page it would be its own active tab.
      const popup = await context.newPage();
      await popup.addInitScript((stub) => {
        chrome.tabs.query = (async () => [stub]) as unknown as typeof chrome.tabs.query;
      }, tab);
      await popup.goto(popupUrl);
      await expect(popup.getByText("Looking up...")).toHaveCount(0);
      return popup;
    });
  },
});

export { expect };

export const section = (popup: Page, title: string) =>
  popup.locator("section").filter({ has: popup.getByRole("heading", { name: title }) });

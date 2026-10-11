import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

export type Target = "chromium" | "firefox";

const SOURCE = "src/manifest.json";

// Chromium stores reject background.scripts under Manifest V3 and Firefox has no
// background service workers, so each target gets only its own background key.
export function manifestFor(base: Record<string, unknown>, target: Target): Record<string, unknown> {
  if (target === "firefox") return { ...base, background: { scripts: ["background.js"] } };
  const { browser_specific_settings: _, ...chromium } = base;
  return { ...chromium, background: { service_worker: "background.js" } };
}

// Emits manifest.json with the bundle, so watch rebuilds keep it in place.
export function manifest(target: Target): Plugin {
  return {
    name: "spectral-manifest",
    buildStart() {
      this.addWatchFile(SOURCE);
    },
    async generateBundle() {
      const base = JSON.parse(await readFile(SOURCE, "utf8"));
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: `${JSON.stringify(manifestFor(base, target), null, 2)}\n`,
      });
    },
  };
}

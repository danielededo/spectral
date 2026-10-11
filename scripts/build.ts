import { rm } from "node:fs/promises";
import { build } from "vite";
import { manifest, type Target } from "./manifest.ts";

// The background must be one classic script: Safari ignores "type": "module" for it,
// so it cannot share chunks with the popup and is built separately as an IIFE.
// Each browser family gets its own output, differing only in manifest.json.
const watch = process.argv.includes("--watch");
const mode = watch ? "development" : "production";
const targets: Record<string, Target> = { dist: "chromium", "dist-firefox": "firefox" };

for (const [outDir, target] of Object.entries(targets)) {
  await rm(outDir, { recursive: true, force: true });

  await build({ mode, plugins: [manifest(target)], build: { outDir, watch: watch ? {} : null } });

  await build({
    configFile: false,
    mode,
    build: {
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      sourcemap: watch,
      watch: watch ? {} : null,
      lib: {
        entry: "src/background.ts",
        formats: ["iife"],
        name: "spectralBackground",
        fileName: () => "background.js",
      },
    },
  });
}

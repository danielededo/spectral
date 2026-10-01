import { rm } from "node:fs/promises";
import { build } from "vite";

// The background must be one classic script: Safari ignores "type": "module" for it,
// so it cannot share chunks with the popup and is built separately as an IIFE.
const watch = process.argv.includes("--watch");
const mode = watch ? "development" : "production";

await rm("dist", { recursive: true, force: true });

await build({ mode, build: { watch: watch ? {} : null } });

await build({
  configFile: false,
  mode,
  build: {
    outDir: "dist",
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

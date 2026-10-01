import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: mode === "development",
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { popup: "src/popup/index.html" },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
}));

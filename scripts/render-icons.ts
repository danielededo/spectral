import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const SIZES = [16, 32, 48, 128];
const root = path.resolve(import.meta.dirname, "..");
const svg = await readFile(path.join(root, "scripts/icon.svg"), "utf8");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: path.join(root, `public/icons/icon-${size}.png`), omitBackground: true });
}
await browser.close();

import { describe, expect, it } from "vitest";
import { manifestFor } from "./manifest.ts";

const base = {
  manifest_version: 3,
  name: "Spectral",
  browser_specific_settings: { gecko: { id: "spectral@danielededo.it" } },
};

describe("manifestFor", () => {
  it("gives Chromium only the service worker and no Gecko settings", () => {
    const manifest = manifestFor(base, "chromium");
    expect(manifest.background).toEqual({ service_worker: "background.js" });
    expect(manifest).not.toHaveProperty("browser_specific_settings");
    expect(manifest.name).toBe("Spectral");
  });

  it("gives Firefox only the background script and keeps Gecko settings", () => {
    const manifest = manifestFor(base, "firefox");
    expect(manifest.background).toEqual({ scripts: ["background.js"] });
    expect(manifest.browser_specific_settings).toEqual(base.browser_specific_settings);
  });
});

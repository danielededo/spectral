import { describe, expect, it } from "vitest";
import { GLOBAL_PATHS, MARKER_QUERIES, cleanVersion, detectTech, normalizeSnapshot } from "./detect";
import { type PageSnapshot, probePage } from "./probe";

const page = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
  generators: [],
  scripts: [],
  stylesheets: [],
  globals: {},
  markers: {},
  ...overrides,
});

const summary = (techs: ReturnType<typeof detectTech>) =>
  techs.map((t) => `${t.category}:${t.name}${t.version ? ` ${t.version}` : ""}`);

describe("cleanVersion", () => {
  it("keeps version-shaped strings and strips a leading v", () => {
    expect(cleanVersion("v4.5.2")).toBe("4.5.2");
    expect(cleanVersion("18.3.1-canary")).toBe("18.3.1-canary");
  });

  it("drops anything that is not a version", () => {
    expect(cleanVersion("<img src=x onerror=alert(1)>")).toBeNull();
    expect(cleanVersion("latest")).toBeNull();
    expect(cleanVersion("")).toBeNull();
    expect(cleanVersion(null)).toBeNull();
    expect(cleanVersion("1".repeat(40))).toBeNull();
  });
});

describe("detectTech", () => {
  it("reads CMS and version from the generator meta tag", () => {
    expect(summary(detectTech(page({ generators: ["WordPress 6.5.2"] }), {}))).toEqual(["cms:WordPress 6.5.2"]);
    expect(summary(detectTech(page({ generators: ["Astro v4.16.1"] }), {}))).toEqual(["framework:Astro 4.16.1"]);
  });

  it("merges evidence from several sources into one entry", () => {
    const techs = detectTech(
      page({ scripts: ["https://example.it/_next/static/chunks/main.js"], globals: { __NEXT_DATA__: true } }),
      { "x-powered-by": "Next.js" },
    );
    expect(techs).toHaveLength(1);
    expect(techs[0]).toMatchObject({ name: "Next.js", category: "framework", version: null });
    expect(techs[0].evidence).toEqual([
      "script example.it/_next/static/chunks/main.js",
      "window.__NEXT_DATA__",
      "x-powered-by: Next.js",
    ]);
  });

  it("takes versions from globals, script names and attributes", () => {
    const techs = detectTech(
      page({
        globals: { "jQuery.fn.jquery": "3.7.1", "THREE.REVISION": "160" },
        scripts: ["https://browser.sentry-cdn.com/7.100.0/bundle.min.js"],
        markers: { "[ng-version]": "17.3.0" },
      }),
      {},
    );
    expect(summary(techs)).toEqual([
      "framework:Angular 17.3.0",
      "library:jQuery 3.7.1",
      "library:three.js 160",
      "service:Sentry 7.100.0",
    ]);
  });

  it("recognizes jQuery and Bootstrap from file names without false positives", () => {
    const techs = detectTech(
      page({
        scripts: ["/js/jquery-3.6.0.min.js", "/js/jquery.validate.min.js", "/js/jquery-ui.min.js"],
        stylesheets: [
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
          "/css/bootstrap-icons.css",
        ],
      }),
      {},
    );
    expect(summary(techs)).toEqual(["library:jQuery 3.6.0", "ui:Bootstrap 5.3.2"]);
    expect(summary(detectTech(page({ stylesheets: ["/icons/bootstrap-icons.css"] }), {}))).toEqual([]);
  });

  it("uses headers alone when the page could not be read", () => {
    expect(summary(detectTech(null, { "x-powered-by": "PHP/8.2.12", "x-pingback": "https://a.it/xmlrpc.php" }))).toEqual([
      "cms:WordPress",
      "runtime:PHP 8.2.12",
    ]);
  });

  it("discards hostile version strings but keeps the detection", () => {
    const techs = detectTech(page({ globals: { "React.version": "<script>alert(1)</script>" } }), {});
    expect(techs).toEqual([{ name: "React", category: "library", version: null, evidence: ["window.React.version"] }]);
  });

  it("shows script URLs without query strings, truncated when long", () => {
    const gtm = detectTech(page({ scripts: ["https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"] }), {});
    expect(gtm[0].evidence).toEqual(["script www.googletagmanager.com/gtm.js"]);
    const long = detectTech(page({ scripts: [`/wp-content/${"a".repeat(100)}.js`] }), {});
    expect(long[0].evidence[0]).toHaveLength("script ".length + 80);
    expect(long[0].evidence[0].endsWith("…")).toBe(true);
  });
});

describe("normalizeSnapshot", () => {
  it("keeps only the expected shape and known keys", () => {
    expect(
      normalizeSnapshot({
        generators: ["Hugo 0.125", 42, { evil: true }],
        scripts: "not-an-array",
        stylesheets: ["/a.css"],
        globals: { "jQuery.fn.jquery": "3.7.1", "React.version": { toString: "x" }, "document.cookie": "secret" },
        markers: { "#__next": true, "img[onerror]": true },
      }),
    ).toEqual({
      generators: ["Hugo 0.125"],
      scripts: [],
      stylesheets: ["/a.css"],
      globals: { "jQuery.fn.jquery": "3.7.1" },
      markers: { "#__next": true },
    });
  });

  it("rejects non-objects", () => {
    expect(normalizeSnapshot(null)).toBeNull();
    expect(normalizeSnapshot("snapshot")).toBeNull();
  });
});

describe("probe inputs", () => {
  it("asks the page only for known globals and markers", () => {
    expect(GLOBAL_PATHS).toContain("jQuery.fn.jquery");
    expect(new Set(GLOBAL_PATHS).size).toBe(GLOBAL_PATHS.length);
    expect(MARKER_QUERIES).toContainEqual(["[ng-version]", "ng-version"]);
    expect(MARKER_QUERIES).toContainEqual(["#__next", null]);
  });

  it("does not reference anything outside its own body, as chrome.scripting requires", () => {
    const source = probePage.toString();
    expect(source).not.toMatch(/\bimport\b|\brequire\(/);
    expect(() => new Function(`return (${source})`)()).not.toThrow();
  });
});

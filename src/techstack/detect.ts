import type { HeaderMap } from "../infrastructure/detect";
import type { MarkerQuery, PageSnapshot } from "./probe";

export type TechCategory =
  | "framework"
  | "cms"
  | "library"
  | "analytics"
  | "commerce"
  | "runtime"
  | "ui"
  | "service"
  | "consent";

export interface Tech {
  name: string;
  category: TechCategory;
  version: string | null;
  evidence: string[];
}

interface Hit {
  version?: string | null;
  evidence: string;
}

interface Rule {
  name: string;
  category: TechCategory;
  generator?: RegExp;
  script?: RegExp;
  stylesheet?: RegExp;
  global?: string;
  marker?: string;
  header?: [name: string, pattern: RegExp];
}

// A capture group 1, when present, is the version.
const RULES: Rule[] = [
  { name: "WordPress", category: "cms", generator: /^WordPress\s*([\d.]+)?/i },
  { name: "WordPress", category: "cms", script: /\/wp-(?:content|includes)\// },
  { name: "WordPress", category: "cms", header: ["x-pingback", /\/xmlrpc\.php/] },
  { name: "Drupal", category: "cms", generator: /^Drupal\s*([\d.]+)?/i },
  { name: "Drupal", category: "cms", header: ["x-generator", /^Drupal\s*([\d.]+)?/i] },
  { name: "Drupal", category: "cms", header: ["x-drupal-cache", /./] },
  { name: "Joomla", category: "cms", generator: /^Joomla!?/i },
  { name: "Ghost", category: "cms", generator: /^Ghost\s*([\d.]+)?/i },
  { name: "Wix", category: "cms", generator: /^Wix\.com/i },
  { name: "Wix", category: "cms", header: ["x-wix-request-id", /./] },
  { name: "Squarespace", category: "cms", generator: /^Squarespace/i },
  { name: "Webflow", category: "cms", generator: /^Webflow/i },
  { name: "Webflow", category: "cms", global: "Webflow" },
  { name: "Hugo", category: "framework", generator: /^Hugo\s*([\d.]+)?/i },
  { name: "Jekyll", category: "framework", generator: /^Jekyll\s*v?([\d.]+)?/i },
  { name: "Astro", category: "framework", generator: /^Astro\s*v?([\d.]+)?/i },
  { name: "Astro", category: "framework", script: /\/_astro\// },
  { name: "Astro", category: "framework", marker: "astro-island" },
  { name: "Gatsby", category: "framework", generator: /^Gatsby\s*([\d.]+)?/i },
  { name: "Gatsby", category: "framework", marker: "#___gatsby" },
  { name: "Docusaurus", category: "framework", generator: /^Docusaurus\s*v?([\d.]+)?/i },
  { name: "VitePress", category: "framework", generator: /^VitePress\s*v?([\d.]+)?/i },
  { name: "Next.js", category: "framework", script: /\/_next\/static\// },
  { name: "Next.js", category: "framework", global: "__NEXT_DATA__" },
  { name: "Next.js", category: "framework", marker: "#__next" },
  { name: "Next.js", category: "framework", header: ["x-powered-by", /^Next\.js\s*([\d.]+)?/i] },
  { name: "Next.js", category: "framework", header: ["x-nextjs-cache", /./] },
  { name: "Nuxt", category: "framework", script: /\/_nuxt\// },
  { name: "Nuxt", category: "framework", global: "__NUXT__" },
  { name: "Nuxt", category: "framework", marker: "#__nuxt" },
  { name: "Remix", category: "framework", global: "__remixContext" },
  { name: "Angular", category: "framework", marker: "[ng-version]" },
  { name: "AngularJS", category: "framework", global: "angular.version.full" },
  { name: "React", category: "library", global: "React.version" },
  { name: "React", category: "library", marker: "[data-reactroot]" },
  { name: "Vue.js", category: "library", global: "Vue.version" },
  { name: "Vue.js", category: "library", marker: "[data-v-app]" },
  { name: "Svelte", category: "library", marker: "[data-svelte-h]" },
  { name: "Ember.js", category: "library", global: "Ember.VERSION" },
  { name: "Alpine.js", category: "library", global: "Alpine.version" },
  { name: "htmx", category: "library", global: "htmx.version" },
  { name: "Turbo", category: "library", global: "Turbo" },
  { name: "jQuery", category: "library", global: "jQuery.fn.jquery" },
  { name: "jQuery", category: "library", script: /jquery[.-]?(\d+\.\d+\.\d+)?(?:\.min|\.slim)*\.js/i },
  { name: "Backbone.js", category: "library", global: "Backbone.VERSION" },
  { name: "Moment.js", category: "library", global: "moment.version" },
  { name: "GSAP", category: "library", global: "gsap.version" },
  { name: "three.js", category: "library", global: "THREE.REVISION" },
  { name: "Bootstrap", category: "ui", stylesheet: /bootstrap(?!-icons)(?:@|[.-]v?)?(\d+\.\d+\.\d+)?(?=[^/]*\.css|\/)/i },
  { name: "Bootstrap", category: "ui", global: "bootstrap.Tooltip.VERSION" },
  { name: "Tailwind CSS", category: "ui", script: /cdn\.tailwindcss\.com/ },
  { name: "Font Awesome", category: "ui", stylesheet: /font-?awesome/i },
  { name: "Font Awesome", category: "ui", script: /kit\.fontawesome\.com/ },
  { name: "Google Fonts", category: "ui", stylesheet: /fonts\.googleapis\.com/ },
  { name: "Adobe Fonts", category: "ui", stylesheet: /use\.typekit\.net/ },
  { name: "PHP", category: "runtime", header: ["x-powered-by", /PHP\/?([\d.]+)?/i] },
  { name: "Express", category: "runtime", header: ["x-powered-by", /^Express/i] },
  { name: "ASP.NET", category: "runtime", header: ["x-powered-by", /ASP\.NET/i] },
  { name: "ASP.NET", category: "runtime", header: ["x-aspnet-version", /^([\d.]+)/] },
  { name: "Shopify", category: "commerce", script: /cdn\.shopify\.com/ },
  { name: "Shopify", category: "commerce", global: "Shopify" },
  { name: "WooCommerce", category: "commerce", script: /\/woocommerce\// },
  { name: "Stripe", category: "commerce", script: /js\.stripe\.com/ },
  { name: "PayPal", category: "commerce", script: /paypal\.com\/sdk\/js/ },
  { name: "Google Tag Manager", category: "analytics", script: /googletagmanager\.com\/gtm\.js/ },
  { name: "Google Analytics", category: "analytics", script: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(?:analytics|ga)\.js/ },
  { name: "Plausible", category: "analytics", script: /plausible\.io\/js\// },
  { name: "Fathom", category: "analytics", script: /cdn\.usefathom\.com/ },
  { name: "Matomo", category: "analytics", script: /\/(?:matomo|piwik)\.js/ },
  { name: "Cloudflare Web Analytics", category: "analytics", script: /static\.cloudflareinsights\.com\/beacon/ },
  { name: "Microsoft Clarity", category: "analytics", script: /clarity\.ms\/tag\// },
  { name: "Hotjar", category: "analytics", script: /static\.hotjar\.com/ },
  { name: "Meta Pixel", category: "analytics", script: /connect\.facebook\.net\/[^/]+\/fbevents\.js/ },
  { name: "Segment", category: "analytics", script: /cdn\.segment\.com/ },
  { name: "Sentry", category: "service", global: "Sentry.SDK_VERSION" },
  { name: "Sentry", category: "service", script: /browser\.sentry-cdn\.com\/(\d+\.\d+\.\d+)?/ },
  { name: "Intercom", category: "service", script: /widget\.intercom\.io/ },
  { name: "HubSpot", category: "service", script: /js\.hs-scripts\.com|js\.hsforms\.net/ },
  { name: "Zendesk", category: "service", script: /static\.zdassets\.com/ },
  { name: "reCAPTCHA", category: "service", script: /google\.com\/recaptcha\/|recaptcha\/api\.js/ },
  { name: "Cloudflare Turnstile", category: "service", script: /challenges\.cloudflare\.com\/turnstile/ },
  { name: "Cookiebot", category: "consent", script: /consent\.cookiebot\.com/ },
  { name: "OneTrust", category: "consent", script: /cdn\.cookielaw\.org/ },
  { name: "iubenda", category: "consent", script: /cdn\.iubenda\.com/ },
];

export const GLOBAL_PATHS = [...new Set(RULES.flatMap((r) => (r.global ? [r.global] : [])))];

export const MARKER_QUERIES: MarkerQuery[] = [
  ...new Set(RULES.flatMap((r) => (r.marker ? [r.marker] : []))),
].map((selector) => [selector, selector === "[ng-version]" ? "ng-version" : null]);

const strings = (value: unknown, limit: number): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, limit) : [];

function flags(value: unknown, allowed: readonly string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  if (!value || typeof value !== "object") return out;
  for (const key of allowed) {
    const v = (value as Record<string, unknown>)[key];
    if (v === true || typeof v === "string") out[key] = v;
  }
  return out;
}

// The probe runs in the page's world, so its result is untrusted input of unknown shape.
export function normalizeSnapshot(raw: unknown): PageSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    generators: strings(r.generators, 10),
    scripts: strings(r.scripts, 200),
    stylesheets: strings(r.stylesheets, 200),
    globals: flags(r.globals, GLOBAL_PATHS),
    markers: flags(r.markers, MARKER_QUERIES.map(([selector]) => selector)),
  };
}

// Page data is attacker-controlled: keep only version-shaped strings.
export function cleanVersion(value: string | null | undefined): string | null {
  const v = value?.trim().replace(/^v/i, "");
  return v && /^\d[\w.+-]{0,31}$/.test(v) ? v : null;
}

function shortUrl(url: string): string {
  let shown = url;
  try {
    const u = new URL(url, "https://page.invalid");
    shown = u.host === "page.invalid" ? u.pathname : `${u.host}${u.pathname}`;
  } catch {
    // Keep the raw attribute value.
  }
  return shown.length > 80 ? `${shown.slice(0, 79)}…` : shown;
}

function firstMatch(values: string[], pattern: RegExp): { value: string; version: string | null } | null {
  for (const value of values) {
    const m = pattern.exec(value);
    if (m) return { value, version: m[1] ?? null };
  }
  return null;
}

function match(rule: Rule, page: PageSnapshot | null, headers: HeaderMap): Hit | null {
  if (rule.header) {
    const [name, pattern] = rule.header;
    const value = headers[name];
    const m = value === undefined ? null : pattern.exec(value);
    return m ? { version: m[1], evidence: `${name}: ${value}` } : null;
  }
  if (!page) return null;
  if (rule.generator) {
    const hit = firstMatch(page.generators, rule.generator);
    return hit && { version: hit.version, evidence: `generator: ${hit.value}` };
  }
  if (rule.script) {
    const hit = firstMatch(page.scripts, rule.script);
    return hit && { version: hit.version, evidence: `script ${shortUrl(hit.value)}` };
  }
  if (rule.stylesheet) {
    const hit = firstMatch(page.stylesheets, rule.stylesheet);
    return hit && { version: hit.version, evidence: `stylesheet ${shortUrl(hit.value)}` };
  }
  if (rule.global) {
    const value = page.globals[rule.global];
    if (value === undefined) return null;
    return { version: value === true ? null : value, evidence: `window.${rule.global}` };
  }
  if (rule.marker) {
    const value = page.markers[rule.marker];
    if (value === undefined) return null;
    return { version: value === true ? null : value, evidence: `element ${rule.marker}` };
  }
  return null;
}

export function detectTech(page: PageSnapshot | null, headers: HeaderMap): Tech[] {
  const byName = new Map<string, Tech>();
  for (const rule of RULES) {
    const hit = match(rule, page, headers);
    if (!hit) continue;
    const version = cleanVersion(hit.version);
    const existing = byName.get(rule.name);
    if (existing) {
      existing.version ??= version;
      if (!existing.evidence.includes(hit.evidence)) existing.evidence.push(hit.evidence);
    } else {
      byName.set(rule.name, { name: rule.name, category: rule.category, version, evidence: [hit.evidence] });
    }
  }
  return [...byName.values()];
}

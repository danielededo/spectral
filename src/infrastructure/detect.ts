export type Category = "cdn" | "hosting" | "waf" | "server" | "dns" | "mail" | "sender" | "saas";

export interface Signal {
  category: Category;
  provider: string;
  evidence: string[];
}

export type HeaderMap = Record<string, string>;

interface HeaderRule {
  category: Category;
  provider: string;
  match: (h: HeaderMap) => string | null;
}

interface SuffixRule {
  category: Category;
  provider: string;
  pattern: RegExp;
}

const has = (name: string) => (h: HeaderMap) => (name in h ? `${name} header` : null);

const valueMatches = (name: string, pattern: RegExp) => (h: HeaderMap) =>
  h[name] !== undefined && pattern.test(h[name]) ? `${name}: ${h[name]}` : null;

const anyOf =
  (...matchers: Array<(h: HeaderMap) => string | null>) =>
  (h: HeaderMap) => {
    for (const m of matchers) {
      const hit = m(h);
      if (hit) return hit;
    }
    return null;
  };

const HEADER_RULES: HeaderRule[] = [
  { category: "cdn", provider: "Cloudflare", match: anyOf(has("cf-ray"), valueMatches("server", /^cloudflare/i)) },
  { category: "cdn", provider: "Amazon CloudFront", match: anyOf(has("x-amz-cf-id"), valueMatches("via", /cloudfront/i)) },
  { category: "cdn", provider: "Fastly", match: anyOf(has("x-fastly-request-id"), valueMatches("x-served-by", /^cache-/i)) },
  {
    category: "cdn",
    provider: "Akamai",
    match: anyOf(has("x-akamai-transformed"), has("akamai-grn"), valueMatches("server", /^akamai/i)),
  },
  { category: "cdn", provider: "Azure Front Door", match: has("x-azure-ref") },
  { category: "cdn", provider: "Bunny CDN", match: valueMatches("server", /^bunnycdn/i) },
  { category: "cdn", provider: "KeyCDN", match: valueMatches("server", /^keycdn/i) },
  { category: "hosting", provider: "Vercel", match: anyOf(has("x-vercel-id"), valueMatches("server", /^vercel/i)) },
  { category: "hosting", provider: "Netlify", match: anyOf(has("x-nf-request-id"), valueMatches("server", /^netlify/i)) },
  { category: "hosting", provider: "GitHub Pages", match: valueMatches("server", /^github\.com$/i) },
  {
    category: "hosting",
    provider: "Google Cloud",
    match: anyOf(valueMatches("server", /^(google frontend|gws|esf)$/i), valueMatches("via", /\bgoogle\b/i)),
  },
  { category: "hosting", provider: "Amazon S3", match: valueMatches("server", /^amazons3$/i) },
  { category: "hosting", provider: "AWS Elastic Load Balancing", match: valueMatches("server", /^awselb/i) },
  { category: "hosting", provider: "Heroku", match: anyOf(valueMatches("via", /vegur/i), valueMatches("server", /^heroku/i)) },
  { category: "hosting", provider: "Fly.io", match: anyOf(has("fly-request-id"), valueMatches("server", /^fly\//i)) },
  { category: "hosting", provider: "Render", match: anyOf(has("rndr-id"), has("x-render-origin-server")) },
  { category: "hosting", provider: "Shopify", match: anyOf(has("x-shopid"), has("x-shopify-stage")) },
  { category: "hosting", provider: "WP Engine", match: valueMatches("x-powered-by", /wp engine/i) },
  { category: "hosting", provider: "Kinsta", match: has("x-kinsta-cache") },
  { category: "waf", provider: "Sucuri", match: has("x-sucuri-id") },
  { category: "waf", provider: "Imperva", match: anyOf(has("x-iinfo"), valueMatches("x-cdn", /incapsula|imperva/i)) },
  { category: "server", provider: "Varnish", match: has("x-varnish") },
];

const SERVER_SOFTWARE: Array<[RegExp, string]> = [
  [/^nginx/i, "nginx"],
  [/^openresty/i, "OpenResty"],
  [/^apache/i, "Apache HTTP Server"],
  [/^litespeed/i, "LiteSpeed"],
  [/^microsoft-iis/i, "Microsoft IIS"],
  [/^caddy/i, "Caddy"],
  [/^envoy/i, "Envoy"],
  [/^istio-envoy/i, "Envoy"],
];

const CNAME_RULES: SuffixRule[] = [
  { category: "cdn", provider: "Amazon CloudFront", pattern: /\.cloudfront\.net$/ },
  { category: "cdn", provider: "Fastly", pattern: /\.(fastly\.net|fastlylb\.net)$/ },
  { category: "cdn", provider: "Akamai", pattern: /\.(akamaiedge\.net|edgekey\.net|edgesuite\.net|akamai\.net)$/ },
  { category: "cdn", provider: "Azure Front Door", pattern: /\.(azureedge\.net|azurefd\.net)$/ },
  { category: "cdn", provider: "Bunny CDN", pattern: /\.b-cdn\.net$/ },
  { category: "cdn", provider: "Cloudflare", pattern: /\.cdn\.cloudflare\.net$/ },
  { category: "hosting", provider: "Cloudflare Pages", pattern: /\.pages\.dev$/ },
  { category: "hosting", provider: "Azure App Service", pattern: /\.(azurewebsites\.net|trafficmanager\.net)$/ },
  { category: "hosting", provider: "Heroku", pattern: /\.(herokudns\.com|herokuapp\.com)$/ },
  { category: "hosting", provider: "Vercel", pattern: /\.(vercel-dns\.com|vercel\.app)$/ },
  { category: "hosting", provider: "Netlify", pattern: /\.(netlify\.app|netlify\.com)$/ },
  { category: "hosting", provider: "GitHub Pages", pattern: /\.github\.io$/ },
  { category: "hosting", provider: "AWS Elastic Load Balancing", pattern: /\.elb\.amazonaws\.com$/ },
  { category: "hosting", provider: "Amazon S3", pattern: /\.s3[.-][a-z0-9.-]*amazonaws\.com$/ },
  { category: "hosting", provider: "Google Cloud", pattern: /(^|\.)ghs\.googlehosted\.com$|\.run\.app$/ },
  { category: "hosting", provider: "Firebase Hosting", pattern: /\.(web\.app|firebaseapp\.com)$/ },
  { category: "hosting", provider: "Shopify", pattern: /\.myshopify\.com$/ },
  { category: "hosting", provider: "WP Engine", pattern: /\.wpengine\.com$/ },
  { category: "hosting", provider: "Fly.io", pattern: /\.fly\.dev$/ },
  { category: "hosting", provider: "Render", pattern: /\.onrender\.com$/ },
  { category: "hosting", provider: "Squarespace", pattern: /\.squarespace\.com$/ },
  { category: "hosting", provider: "Wix", pattern: /\.wixdns\.net$/ },
];

const NS_RULES: SuffixRule[] = [
  { category: "dns", provider: "Cloudflare", pattern: /\.ns\.cloudflare\.com$/ },
  { category: "dns", provider: "Amazon Route 53", pattern: /\.awsdns-\d+\.[a-z.]+$/ },
  { category: "dns", provider: "Azure DNS", pattern: /\.azure-dns\.[a-z.]+$/ },
  { category: "dns", provider: "Google Cloud DNS", pattern: /\.googledomains\.com$/ },
  { category: "dns", provider: "OVHcloud", pattern: /\.(ovh\.net|ovh\.ca|anycast\.me)$/ },
  { category: "dns", provider: "GoDaddy", pattern: /\.domaincontrol\.com$/ },
  { category: "dns", provider: "Namecheap", pattern: /\.registrar-servers\.com$/ },
  { category: "dns", provider: "NS1", pattern: /\.nsone\.net$/ },
  { category: "dns", provider: "DNSimple", pattern: /\.dnsimple(-edge)?\.(com|net|org|info)$/ },
  { category: "dns", provider: "DigitalOcean", pattern: /\.digitalocean\.com$/ },
  { category: "dns", provider: "Hetzner", pattern: /\.(hetzner\.com|hetzner\.de|your-server\.de)$/ },
  { category: "dns", provider: "Vercel", pattern: /\.vercel-dns\.com$/ },
  { category: "dns", provider: "Gandi", pattern: /\.gandi\.net$/ },
  { category: "dns", provider: "Aruba", pattern: /\.aruba\.it$/ },
  { category: "dns", provider: "Register.it", pattern: /\.register\.it$/ },
  { category: "dns", provider: "Hostinger", pattern: /\.dns-parking\.com$/ },
  { category: "dns", provider: "Wix", pattern: /\.wixdns\.net$/ },
  { category: "dns", provider: "Squarespace", pattern: /\.squarespacedns\.com$/ },
  { category: "dns", provider: "Akamai Edge DNS", pattern: /\.akam\.net$/ },
  { category: "dns", provider: "UltraDNS", pattern: /\.ultradns\.[a-z]+$/ },
];

const MX_RULES: SuffixRule[] = [
  { category: "mail", provider: "Google Workspace", pattern: /\.(google\.com|googlemail\.com)$/ },
  { category: "mail", provider: "Microsoft 365", pattern: /\.(outlook\.com|protection\.outlook\.com)$/ },
  { category: "mail", provider: "OVHcloud", pattern: /\.ovh\.net$/ },
  { category: "mail", provider: "Zoho Mail", pattern: /\.zoho\.[a-z.]+$/ },
  { category: "mail", provider: "Proton Mail", pattern: /\.protonmail\.ch$/ },
  { category: "mail", provider: "Fastmail", pattern: /\.messagingengine\.com$/ },
  { category: "mail", provider: "iCloud Mail", pattern: /\.icloud\.com$/ },
  { category: "mail", provider: "Mimecast", pattern: /\.mimecast\.com$/ },
  { category: "mail", provider: "Proofpoint", pattern: /\.(pphosted\.com|ppe-hosted\.com)$/ },
  { category: "mail", provider: "Cisco Secure Email", pattern: /\.iphmx\.com$/ },
  { category: "mail", provider: "Amazon SES", pattern: /\.amazonaws\.com$/ },
  { category: "mail", provider: "Mailgun", pattern: /\.mailgun\.org$/ },
  { category: "mail", provider: "Yandex Mail", pattern: /\.yandex\.(net|ru)$/ },
  { category: "mail", provider: "Aruba", pattern: /\.aruba\.it$/ },
  { category: "mail", provider: "GoDaddy", pattern: /\.secureserver\.net$/ },
];

const SPF_INCLUDE_RULES: SuffixRule[] = [
  { category: "sender", provider: "Google Workspace", pattern: /(^|\.)_spf\.google\.com$/ },
  { category: "sender", provider: "Microsoft 365", pattern: /(^|\.)spf\.protection\.outlook\.com$/ },
  { category: "sender", provider: "Amazon SES", pattern: /(^|\.)amazonses\.com$/ },
  { category: "sender", provider: "Mailgun", pattern: /(^|\.)mailgun\.org$/ },
  { category: "sender", provider: "SendGrid", pattern: /(^|\.)sendgrid\.net$/ },
  { category: "sender", provider: "Mailchimp", pattern: /(^|\.)(servers\.mcsv\.net|mandrillapp\.com)$/ },
  { category: "sender", provider: "Postmark", pattern: /(^|\.)mtasv\.net$/ },
  { category: "sender", provider: "Brevo", pattern: /(^|\.)(sendinblue\.com|brevo\.com)$/ },
  { category: "sender", provider: "HubSpot", pattern: /(^|\.)hubspotemail\.net$/ },
  { category: "sender", provider: "Salesforce", pattern: /(^|\.)_spf\.salesforce\.com$/ },
  { category: "sender", provider: "Zendesk", pattern: /(^|\.)mail\.zendesk\.com$/ },
  { category: "sender", provider: "Freshdesk", pattern: /(^|\.)email\.freshdesk\.com$/ },
  { category: "sender", provider: "OVHcloud", pattern: /(^|\.)mx\.ovh\.com$/ },
  { category: "sender", provider: "Zoho Mail", pattern: /(^|\.)zoho\.[a-z.]+$/ },
  { category: "sender", provider: "Proton Mail", pattern: /(^|\.)_spf\.protonmail\.ch$/ },
];

const VERIFICATION_RULES: Array<[RegExp, string]> = [
  [/^google-site-verification=/i, "Google Search Console"],
  [/^facebook-domain-verification=/i, "Meta Business"],
  [/^ms=ms\d+/i, "Microsoft 365"],
  [/^apple-domain-verification=/i, "Apple"],
  [/^atlassian-domain-verification=/i, "Atlassian"],
  [/^docusign=/i, "DocuSign"],
  [/^stripe-verification=/i, "Stripe"],
  [/^adobe-idp-site-verification=/i, "Adobe"],
  [/^zoom-domain-verification=/i, "Zoom"],
  [/^slack-domain-verification=/i, "Slack"],
  [/^openai-domain-verification=/i, "OpenAI"],
  [/^anthropic-domain-verification/i, "Anthropic"],
  [/^globalsign-domain-verification=/i, "GlobalSign"],
  [/^hubspot-developer-verification=/i, "HubSpot"],
  [/^dropbox-domain-verification=/i, "Dropbox"],
  [/^notion-domain-verification=/i, "Notion"],
  [/^miro-verification=/i, "Miro"],
  [/^cisco-ci-domain-verification=/i, "Cisco Webex"],
  [/^mailru-verification/i, "Mail.ru"],
  [/^yandex-verification/i, "Yandex"],
  [/^amazonses:/i, "Amazon SES"],
  [/^mongodb-site-verification=/i, "MongoDB Atlas"],
  [/^postman-domain-verification=/i, "Postman"],
  [/^canva-site-verification=/i, "Canva"],
  [/^figma-domain-verification=/i, "Figma"],
  [/^cursor-domain-verification/i, "Cursor"],
];

export function normalizeHost(name: string): string {
  return name.trim().toLowerCase().replace(/\.$/, "");
}

export function isPublicIp(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return !(v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("::ffff:"));
}

export function toHeaderMap(headers: Array<{ name: string; value?: string }>): HeaderMap {
  const map: HeaderMap = {};
  for (const { name, value } of headers) {
    const key = name.toLowerCase();
    const v = value ?? "";
    map[key] = key in map ? `${map[key]}, ${v}` : v;
  }
  return map;
}

export function detectFromHeaders(headers: HeaderMap): Signal[] {
  const signals: Signal[] = [];
  for (const rule of HEADER_RULES) {
    const evidence = rule.match(headers);
    if (evidence) signals.push({ category: rule.category, provider: rule.provider, evidence: [evidence] });
  }
  const server = headers["server"];
  if (server) {
    for (const [pattern, provider] of SERVER_SOFTWARE) {
      if (pattern.test(server)) {
        signals.push({ category: "server", provider, evidence: [`server: ${server}`] });
        break;
      }
    }
  }
  return mergeSignals(signals);
}

function matchSuffixes(rules: SuffixRule[], names: string[], label: string): Signal[] {
  const signals: Signal[] = [];
  for (const raw of names) {
    const name = normalizeHost(raw);
    const rule = rules.find((r) => r.pattern.test(name));
    if (rule) signals.push({ category: rule.category, provider: rule.provider, evidence: [`${label} ${name}`] });
  }
  return mergeSignals(signals);
}

export const detectFromCnames = (cnames: string[]) => matchSuffixes(CNAME_RULES, cnames, "CNAME");

export const detectFromNameservers = (ns: string[]) => matchSuffixes(NS_RULES, ns, "NS");

export function parseMx(data: string): { priority: number; host: string } {
  const [priority, host = ""] = data.trim().split(/\s+/, 2);
  return { priority: Number(priority), host: normalizeHost(host) };
}

export const detectFromMx = (mxHosts: string[]) => matchSuffixes(MX_RULES, mxHosts, "MX");

export function parseTxt(data: string): string {
  const chunks = data.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!chunks) return data;
  return chunks.map((c) => c.slice(1, -1).replace(/\\(.)/g, "$1")).join("");
}

export function spfIncludes(txt: string[]): string[] {
  const spf = txt.find((t) => /^v=spf1\b/i.test(t));
  if (!spf) return [];
  return [...spf.matchAll(/\binclude:(\S+)/gi)].map((m) => normalizeHost(m[1]));
}

export function detectFromTxt(txt: string[]): Signal[] {
  const signals = matchSuffixes(SPF_INCLUDE_RULES, spfIncludes(txt), "SPF include");
  for (const record of txt) {
    const hit = VERIFICATION_RULES.find(([pattern]) => pattern.test(record));
    if (hit) {
      const token = record.split(/[=:]/, 1)[0];
      signals.push({ category: "saas", provider: hit[1], evidence: [`TXT ${token}`] });
    }
  }
  return mergeSignals(signals);
}

export function mergeSignals(signals: Signal[]): Signal[] {
  const byKey = new Map<string, Signal>();
  for (const s of signals) {
    const key = `${s.category}|${s.provider}`;
    const existing = byKey.get(key);
    if (existing) {
      for (const e of s.evidence) if (!existing.evidence.includes(e)) existing.evidence.push(e);
    } else {
      byKey.set(key, { ...s, evidence: [...s.evidence] });
    }
  }
  return [...byKey.values()];
}

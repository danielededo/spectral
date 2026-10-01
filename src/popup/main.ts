import {
  type Category,
  type Signal,
  detectFromCnames,
  detectFromHeaders,
  detectFromMx,
  detectFromNameservers,
  detectFromTxt,
  isPublicIp,
  mergeSignals,
  spfIncludes,
} from "../infrastructure/detect";
import { lookupIp, resolveHost, resolveMailPolicy, resolveZone } from "../infrastructure/lookup";
import {
  describeDmarc,
  describeMtaSts,
  describeSpf,
  describeTlsRpt,
  detectReporters,
  evaluateDmarc,
  evaluateMtaSts,
  evaluateSpf,
  evaluateTlsRpt,
} from "../infrastructure/mail";
import { type Capture, loadCapture } from "../shared/capture";
import { GLOBAL_PATHS, MARKER_QUERIES, type Tech, type TechCategory, detectTech, normalizeSnapshot } from "../techstack/detect";
import { type PageSnapshot, probePage } from "../techstack/probe";

const CATEGORY_LABEL: Record<Category, string> = {
  cdn: "CDN",
  hosting: "hosting",
  waf: "WAF",
  server: "server",
  dns: "DNS",
  mail: "inbound mail",
  sender: "sends mail",
  reports: "DMARC reports",
  saas: "verified",
};

const TECH_LABEL: Record<TechCategory, string> = {
  framework: "framework",
  cms: "CMS",
  library: "JS library",
  analytics: "analytics",
  commerce: "commerce",
  runtime: "server runtime",
  ui: "UI and fonts",
  service: "service",
  consent: "cookie consent",
};

type Child = Node | string | null;

function el(tag: string, className?: string, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) if (child !== null) node.append(child);
  return node;
}

function section(title: string): { root: HTMLElement; body: HTMLElement } {
  const body = el("div", undefined, el("p", "muted", "Looking up..."));
  const root = el("section", undefined, el("h2", undefined, title), body);
  document.getElementById("sections")!.append(root);
  return { root, body };
}

function findingList(items: Array<{ title: string; tag: string; evidence: string[] }>, empty: string): HTMLElement {
  if (items.length === 0) return el("p", "muted", empty);
  return el(
    "div",
    undefined,
    ...items.map((item) =>
      el(
        "div",
        "signal",
        el("span", "provider", item.title),
        el("span", "tag", item.tag),
        el("span", "evidence", item.evidence.join(" · ")),
      ),
    ),
  );
}

const signalList = (signals: Signal[], empty: string) =>
  findingList(
    signals.map((s) => ({ title: s.provider, tag: CATEGORY_LABEL[s.category], evidence: s.evidence })),
    empty,
  );

const techList = (techs: Tech[], empty: string) =>
  findingList(
    techs.map((t) => ({
      title: t.version ? `${t.name} ${t.version}` : t.name,
      tag: TECH_LABEL[t.category],
      evidence: t.evidence,
    })),
    empty,
  );

async function readPage(tabId: number): Promise<PageSnapshot | null> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: probePage,
      args: [GLOBAL_PATHS, MARKER_QUERIES],
    });
    return normalizeSnapshot(injection?.result);
  } catch {
    return null;
  }
}

function facts(rows: Array<[string, string | string[] | null]>): HTMLElement {
  const dl = el("dl");
  for (const [label, value] of rows) {
    if (value === null || (Array.isArray(value) && value.length === 0)) continue;
    dl.append(el("dt", undefined, label), el("dd", undefined, Array.isArray(value) ? value.join("\n") : value));
  }
  return dl;
}

async function fill(target: HTMLElement, work: () => Promise<Child[]>): Promise<void> {
  try {
    target.replaceChildren(...(await work()).filter((c): c is Node | string => c !== null));
  } catch (err) {
    target.replaceChildren(el("p", "error", `Lookup failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}

function captureNote(capture: Capture | null): string {
  if (!capture) return "Response headers not captured yet: reload the page to include them.";
  const age = Math.round((Date.now() - capture.capturedAt) / 1000);
  return `HTTP ${capture.statusCode}${capture.fromCache ? " (from cache)" : ""}, captured ${age}s ago`;
}

async function main(): Promise<void> {
  const hostLine = document.getElementById("host")!;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ? new URL(tab.url) : null;
  if (!tab?.id || !url || !/^https?:$/.test(url.protocol)) {
    hostLine.textContent = "Open a website (http or https) to inspect it.";
    return;
  }

  const tabId = tab.id;
  const hostname = url.hostname;
  const stored = await loadCapture(tabId);
  const capture = stored && new URL(stored.url).hostname === hostname ? stored : null;
  hostLine.textContent = `${hostname} · ${captureNote(capture)}`;

  const edge = section("Edge and hosting");
  const tech = section("Tech stack");
  const network = section("Network");
  const dns = section("DNS");
  const mail = section("Email");
  const services = section("Verified services");

  const host = resolveHost(hostname);
  const zone = resolveZone(hostname);

  void fill(edge.body, async () => {
    const fromHeaders = capture ? detectFromHeaders(capture.headers) : [];
    const records = await host.catch(() => null);
    const signals = mergeSignals([...fromHeaders, ...detectFromCnames(records?.cnames ?? [])]);
    return [
      signalList(signals, "No known CDN or hosting provider fingerprint."),
      records?.cnames.length ? facts([["CNAME chain", records.cnames]]) : null,
    ];
  });

  void fill(tech.body, async () => {
    const snapshot = await readPage(tabId);
    const techs = detectTech(snapshot, capture?.headers ?? {});
    return [
      techList(techs, "No known framework, CMS or library fingerprint."),
      snapshot ? null : el("p", "muted", "The browser does not let extensions read this page; showing header findings only."),
    ];
  });

  void fill(network.body, async () => {
    const records = await host;
    const connected = capture?.ip && isPublicIp(capture.ip) ? capture.ip : null;
    const ip = connected ?? records.a[0] ?? records.aaaa[0] ?? null;
    const owner = ip ? await lookupIp(ip).catch(() => null) : null;
    return [
      facts([
        ["Connected IP", capture?.ip ?? null],
        ["A", records.a],
        ["AAAA", records.aaaa],
        ["Network", owner?.name ?? null],
        ["Owner", owner?.organization ?? null],
        ["Range", owner?.range ?? null],
        ["Country", owner?.country ?? null],
      ]),
    ];
  });

  void fill(dns.body, async () => {
    const z = await zone;
    return [
      signalList(detectFromNameservers(z.ns), "DNS provider not recognized."),
      facts([
        ["Zone", z.apex],
        ["NS", z.ns],
        ["CAA", z.caa],
      ]),
    ];
  });

  void fill(mail.body, async () => {
    const z = await zone;
    const policy = await resolveMailPolicy(z.apex).catch(() => null);
    const dmarc = policy ? evaluateDmarc(policy.dmarc) : null;
    const signals = mergeSignals([
      ...detectFromMx(z.mx.map((m) => m.host)),
      ...detectFromTxt(z.txt).filter((s) => s.category === "sender"),
      ...(dmarc?.status === "ok" ? detectReporters(dmarc.rua) : []),
    ]);
    return [
      signalList(signals, z.mx.length ? "Mail provider not recognized." : "No MX records: the domain receives no email."),
      facts([
        ["MX", z.mx.map((m) => `${m.priority} ${m.host}`)],
        ["SPF", describeSpf(evaluateSpf(z.txt))],
        ["SPF includes", spfIncludes(z.txt)],
        ["DMARC", dmarc ? describeDmarc(dmarc) : "lookup failed"],
        ["DMARC reports", dmarc?.status === "ok" ? dmarc.rua : null],
        ["MTA-STS", policy ? describeMtaSts(evaluateMtaSts(policy.mtaSts)) : "lookup failed"],
        ["TLS-RPT", policy ? describeTlsRpt(evaluateTlsRpt(policy.tlsRpt)) : "lookup failed"],
      ]),
    ];
  });

  void fill(services.body, async () => {
    const z = await zone;
    const signals = detectFromTxt(z.txt).filter((s) => s.category === "saas");
    return [signalList(signals, "No domain verification records found.")];
  });
}

void main();

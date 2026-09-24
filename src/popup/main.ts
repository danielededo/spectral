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
import { lookupIp, resolveHost, resolveZone } from "../infrastructure/lookup";
import { type Capture, loadCapture } from "../shared/capture";

const CATEGORY_LABEL: Record<Category, string> = {
  cdn: "CDN",
  hosting: "hosting",
  waf: "WAF",
  server: "server",
  dns: "DNS",
  mail: "inbound mail",
  sender: "sends mail",
  saas: "verified",
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

function signalList(signals: Signal[], empty: string): HTMLElement {
  if (signals.length === 0) return el("p", "muted", empty);
  return el(
    "div",
    undefined,
    ...signals.map((s) =>
      el(
        "div",
        "signal",
        el("span", "provider", s.provider),
        el("span", "tag", CATEGORY_LABEL[s.category]),
        el("span", "evidence", s.evidence.join(" · ")),
      ),
    ),
  );
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

  const hostname = url.hostname;
  const stored = await loadCapture(tab.id);
  const capture = stored && new URL(stored.url).hostname === hostname ? stored : null;
  hostLine.textContent = `${hostname} · ${captureNote(capture)}`;

  const edge = section("Edge and hosting");
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
    const signals = mergeSignals([
      ...detectFromMx(z.mx.map((m) => m.host)),
      ...detectFromTxt(z.txt).filter((s) => s.category === "sender"),
    ]);
    return [
      signalList(signals, z.mx.length ? "Mail provider not recognized." : "No MX records: the domain receives no email."),
      facts([
        ["MX", z.mx.map((m) => `${m.priority} ${m.host}`)],
        ["SPF includes", spfIncludes(z.txt)],
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

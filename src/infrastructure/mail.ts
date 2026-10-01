import { type Signal, mergeSignals, normalizeHost } from "./detect";

export type Tags = Record<string, string>;

export function parseTags(record: string): Tags {
  const tags: Tags = {};
  for (const part of record.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (key && !(key in tags)) tags[key] = part.slice(eq + 1).trim();
  }
  return tags;
}

const versioned = (txt: string[], version: RegExp) => txt.filter((t) => version.test(t.trim()));

const uriList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

export type PolicyResult<T> =
  | { status: "missing" }
  | { status: "multiple"; count: number }
  | { status: "invalid"; reason: string }
  | ({ status: "ok" } & T);

export interface Dmarc {
  policy: "none" | "quarantine" | "reject";
  subdomainPolicy: "none" | "quarantine" | "reject" | null;
  percent: number;
  rua: string[];
  ruf: string[];
  strictDkim: boolean;
  strictSpf: boolean;
}

const POLICIES = new Set(["none", "quarantine", "reject"]);

export function evaluateDmarc(txt: string[]): PolicyResult<Dmarc> {
  const records = versioned(txt, /^v\s*=\s*DMARC1\s*(;|$)/i);
  if (records.length === 0) return { status: "missing" };
  if (records.length > 1) return { status: "multiple", count: records.length };
  const tags = parseTags(records[0]);
  const p = tags.p?.toLowerCase();
  if (!p || !POLICIES.has(p)) return { status: "invalid", reason: p ? `unknown policy "${tags.p}"` : "no p= tag" };
  const sp = tags.sp?.toLowerCase();
  const pct = tags.pct === undefined ? 100 : Number(tags.pct);
  return {
    status: "ok",
    policy: p as Dmarc["policy"],
    subdomainPolicy: sp && POLICIES.has(sp) ? (sp as Dmarc["policy"]) : null,
    percent: Number.isInteger(pct) && pct >= 0 && pct <= 100 ? pct : 100,
    rua: uriList(tags.rua),
    ruf: uriList(tags.ruf),
    strictDkim: tags.adkim?.toLowerCase() === "s",
    strictSpf: tags.aspf?.toLowerCase() === "s",
  };
}

export interface Spf {
  all: "-all" | "~all" | "?all" | "+all" | null;
  redirect: string | null;
}

export function evaluateSpf(txt: string[]): PolicyResult<Spf> {
  const records = versioned(txt, /^v=spf1(\s|$)/i);
  if (records.length === 0) return { status: "missing" };
  if (records.length > 1) return { status: "multiple", count: records.length };
  const terms = records[0].trim().split(/\s+/).slice(1);
  const all = terms.find((t) => /^[-~?+]?all$/i.test(t));
  const redirect = terms.find((t) => /^redirect=/i.test(t));
  return {
    status: "ok",
    all: all ? ((/^[-~?+]/.test(all) ? all.toLowerCase() : `+${all.toLowerCase()}`) as Spf["all"]) : null,
    redirect: redirect ? normalizeHost(redirect.slice("redirect=".length)) : null,
  };
}

export function evaluateMtaSts(txt: string[]): PolicyResult<{ id: string }> {
  const records = versioned(txt, /^v\s*=\s*STSv1\s*(;|$)/i);
  if (records.length === 0) return { status: "missing" };
  if (records.length > 1) return { status: "multiple", count: records.length };
  const id = parseTags(records[0]).id;
  return id && /^[A-Za-z0-9]{1,32}$/.test(id) ? { status: "ok", id } : { status: "invalid", reason: "missing or malformed id=" };
}

export function evaluateTlsRpt(txt: string[]): PolicyResult<{ rua: string[] }> {
  const records = versioned(txt, /^v\s*=\s*TLSRPTv1\s*(;|$)/i);
  if (records.length === 0) return { status: "missing" };
  if (records.length > 1) return { status: "multiple", count: records.length };
  const rua = uriList(parseTags(records[0]).rua);
  return rua.length ? { status: "ok", rua } : { status: "invalid", reason: "no rua= tag" };
}

const REPORTERS: Array<[RegExp, string]> = [
  [/(^|\.)dmarcian\.(com|eu)$/, "dmarcian"],
  [/(^|\.)valimail\.com$/, "Valimail"],
  [/(^|\.)(ondmarc\.com|redsift\.cloud)$/, "Red Sift OnDMARC"],
  [/(^|\.)easydmarc\.(com|us|eu|co)$/, "EasyDMARC"],
  [/(^|\.)uriports\.com$/, "URIports"],
  [/(^|\.)dmarc\.postmarkapp\.com$/, "Postmark DMARC"],
  [/(^|\.)powerdmarc\.com$/, "PowerDMARC"],
  [/(^|\.)dmarc-reports\.cloudflare\.net$/, "Cloudflare DMARC Management"],
  [/(^|\.)emaildefense\.proofpoint\.com$/, "Proofpoint"],
  [/(^|\.)agari\.com$/, "Agari"],
  [/(^|\.)dmarcanalyzer\.com$/, "Mimecast DMARC Analyzer"],
  [/(^|\.)mailhardener\.com$/, "Mailhardener"],
  [/(^|\.)sendmarc\.com$/, "Sendmarc"],
  [/(^|\.)dmarcly\.com$/, "DMARCLY"],
  [/(^|\.)fraudmarc\.com$/, "Fraudmarc"],
  [/(^|\.)dmarc\.report$/, "DMARC Report"],
];

export function reportDomain(uri: string): string | null {
  const m = /^mailto:[^@\s]+@([^!\s]+)/i.exec(uri.trim());
  return m ? normalizeHost(m[1]) : null;
}

export function detectReporters(uris: string[]): Signal[] {
  const signals: Signal[] = [];
  for (const uri of uris) {
    const domain = reportDomain(uri);
    const hit = domain && REPORTERS.find(([pattern]) => pattern.test(domain));
    if (hit) signals.push({ category: "reports", provider: hit[1], evidence: [`report address @${domain}`] });
  }
  return mergeSignals(signals);
}

const SPF_ALL: Record<NonNullable<Spf["all"]>, string> = {
  "-all": "-all: other senders fail",
  "~all": "~all: other senders soft-fail",
  "?all": "?all: neutral, no protection",
  "+all": "+all: anyone may send, no protection",
};

export function describeSpf(result: PolicyResult<Spf>): string {
  switch (result.status) {
    case "missing":
      return "not published";
    case "multiple":
      return `${result.count} SPF records: receivers treat this as an error`;
    case "invalid":
      return `invalid: ${result.reason}`;
    case "ok":
      if (result.all) return SPF_ALL[result.all];
      return result.redirect ? `delegated to ${result.redirect}` : "no all mechanism: neutral";
  }
}

export function describeDmarc(result: PolicyResult<Dmarc>): string {
  switch (result.status) {
    case "missing":
      return "not published";
    case "multiple":
      return `${result.count} DMARC records: receivers ignore them all`;
    case "invalid":
      return `invalid: ${result.reason}`;
    case "ok": {
      const parts = [result.policy === "none" ? "none (monitoring only)" : result.policy];
      if (result.percent < 100) parts.push(`applied to ${result.percent}% of mail`);
      if (result.subdomainPolicy && result.subdomainPolicy !== result.policy) {
        parts.push(`subdomains: ${result.subdomainPolicy}`);
      }
      const strict = [result.strictDkim && "DKIM", result.strictSpf && "SPF"].filter(Boolean);
      if (strict.length) parts.push(`strict ${strict.join(" and ")} alignment`);
      return parts.join(", ");
    }
  }
}

export function describeMtaSts(result: PolicyResult<{ id: string }>): string {
  switch (result.status) {
    case "missing":
      return "not published";
    case "multiple":
      return `${result.count} records: invalid`;
    case "invalid":
      return `invalid: ${result.reason}`;
    case "ok":
      return `published (policy id ${result.id})`;
  }
}

export function describeTlsRpt(result: PolicyResult<{ rua: string[] }>): string | string[] {
  switch (result.status) {
    case "missing":
      return "not published";
    case "multiple":
      return `${result.count} records: invalid`;
    case "invalid":
      return `invalid: ${result.reason}`;
    case "ok":
      return result.rua;
  }
}

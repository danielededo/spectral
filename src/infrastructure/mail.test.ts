import { describe, expect, it } from "vitest";
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
  parseTags,
  reportDomain,
} from "./mail";

describe("parseTags", () => {
  it("splits tag=value pairs, lowercases keys and keeps the first duplicate", () => {
    expect(parseTags(" v=DMARC1; P=reject ; rua=mailto:a@b.it;p=none; junk ;")).toEqual({
      v: "DMARC1",
      p: "reject",
      rua: "mailto:a@b.it",
    });
  });
});

describe("evaluateDmarc", () => {
  it("parses a full policy", () => {
    expect(
      evaluateDmarc([
        "v=spf1 -all",
        "v=DMARC1; p=quarantine; sp=reject; pct=50; rua=mailto:x@ag.dmarcian.com, mailto:me@example.it; adkim=s",
      ]),
    ).toEqual({
      status: "ok",
      policy: "quarantine",
      subdomainPolicy: "reject",
      percent: 50,
      rua: ["mailto:x@ag.dmarcian.com", "mailto:me@example.it"],
      ruf: [],
      strictDkim: true,
      strictSpf: false,
    });
  });

  it("reports missing, duplicated and invalid records", () => {
    expect(evaluateDmarc([])).toEqual({ status: "missing" });
    expect(evaluateDmarc(["v=DMARC1; p=none", "v=DMARC1; p=reject"])).toEqual({ status: "multiple", count: 2 });
    expect(evaluateDmarc(["v=DMARC1; rua=mailto:a@b.it"])).toEqual({ status: "invalid", reason: "no p= tag" });
    expect(evaluateDmarc(["v=DMARC1; p=block"])).toEqual({ status: "invalid", reason: 'unknown policy "block"' });
  });

  it("does not treat a lookalike version tag as DMARC", () => {
    expect(evaluateDmarc(["v=DMARC10; p=reject"])).toEqual({ status: "missing" });
  });

  it("falls back to 100 percent on a malformed pct", () => {
    const result = evaluateDmarc(["v=DMARC1; p=reject; pct=abc"]);
    expect(result.status === "ok" && result.percent).toBe(100);
  });

  it("describes the policy in one line", () => {
    expect(describeDmarc(evaluateDmarc(["v=DMARC1; p=none"]))).toBe("none (monitoring only)");
    expect(describeDmarc(evaluateDmarc(["v=DMARC1; p=reject; sp=none; pct=25; adkim=s; aspf=s"]))).toBe(
      "reject, applied to 25% of mail, subdomains: none, strict DKIM and SPF alignment",
    );
    expect(describeDmarc(evaluateDmarc([]))).toBe("not published");
    expect(describeDmarc(evaluateDmarc(["v=DMARC1; p=none", "v=DMARC1; p=none"]))).toBe(
      "2 DMARC records: receivers ignore them all",
    );
  });
});

describe("evaluateSpf", () => {
  it("finds the all qualifier, defaulting to +", () => {
    expect(evaluateSpf(["v=spf1 include:_spf.google.com -all"])).toEqual({ status: "ok", all: "-all", redirect: null });
    expect(evaluateSpf(["v=spf1 mx all"])).toEqual({ status: "ok", all: "+all", redirect: null });
    expect(evaluateSpf(["v=spf1 redirect=_spf.Example.it."])).toEqual({
      status: "ok",
      all: null,
      redirect: "_spf.example.it",
    });
  });

  it("flags multiple SPF records as an error", () => {
    expect(evaluateSpf(["v=spf1 -all", "v=spf1 ~all", "google-site-verification=x"])).toEqual({
      status: "multiple",
      count: 2,
    });
  });

  it("ignores lookalike records", () => {
    expect(evaluateSpf(["v=spf10 -all", "spf1 -all"])).toEqual({ status: "missing" });
  });

  it("describes what the policy means for other senders", () => {
    expect(describeSpf(evaluateSpf(["v=spf1 ~all"]))).toBe("~all: other senders soft-fail");
    expect(describeSpf(evaluateSpf(["v=spf1 +all"]))).toBe("+all: anyone may send, no protection");
    expect(describeSpf(evaluateSpf(["v=spf1 redirect=spf.example.it"]))).toBe("delegated to spf.example.it");
    expect(describeSpf(evaluateSpf(["v=spf1 mx"]))).toBe("no all mechanism: neutral");
  });
});

describe("MTA-STS and TLS-RPT", () => {
  it("reads the MTA-STS policy id", () => {
    expect(evaluateMtaSts(["v=STSv1; id=20240101T000000"])).toEqual({ status: "ok", id: "20240101T000000" });
    expect(describeMtaSts(evaluateMtaSts(["v=STSv1; id=abc123"]))).toBe("published (policy id abc123)");
    expect(evaluateMtaSts(["v=STSv1;"])).toEqual({ status: "invalid", reason: "missing or malformed id=" });
    expect(evaluateMtaSts(["v=STSv1; id=<b>x</b>"]).status).toBe("invalid");
    expect(evaluateMtaSts([])).toEqual({ status: "missing" });
  });

  it("reads the TLS-RPT report addresses", () => {
    expect(evaluateTlsRpt(["v=TLSRPTv1; rua=mailto:tls@example.it,https://r.example.it/tls"])).toEqual({
      status: "ok",
      rua: ["mailto:tls@example.it", "https://r.example.it/tls"],
    });
    expect(describeTlsRpt(evaluateTlsRpt(["v=TLSRPTv1;"]))).toBe("invalid: no rua= tag");
    expect(describeTlsRpt(evaluateTlsRpt([]))).toBe("not published");
  });
});

describe("DMARC report providers", () => {
  it("extracts the domain from mailto URIs, ignoring size limits", () => {
    expect(reportDomain("mailto:abc@AG.dmarcian.com!10m")).toBe("ag.dmarcian.com");
    expect(reportDomain("https://reports.example.it")).toBeNull();
  });

  it("recognizes reporting services and merges repeated addresses", () => {
    const signals = detectReporters([
      "mailto:x@rua.easydmarc.eu",
      "mailto:y@rua.easydmarc.eu",
      "mailto:abc@dmarc-reports.cloudflare.net",
      "mailto:me@example.it",
    ]);
    expect(signals.map((s) => s.provider)).toEqual(["EasyDMARC", "Cloudflare DMARC Management"]);
    expect(signals[0]).toEqual({ category: "reports", provider: "EasyDMARC", evidence: ["report address @rua.easydmarc.eu"] });
  });
});

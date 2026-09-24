import { describe, expect, it } from "vitest";
import {
  detectFromCnames,
  detectFromHeaders,
  detectFromMx,
  detectFromNameservers,
  detectFromTxt,
  isPublicIp,
  mergeSignals,
  parseMx,
  parseTxt,
  spfIncludes,
  toHeaderMap,
} from "./detect";
import { summarizeRdap } from "./lookup";

const providers = (signals: Array<{ provider: string }>) => signals.map((s) => s.provider);

describe("isPublicIp", () => {
  it("rejects loopback, private, CGNAT, link-local and ULA addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "100.64.0.1", "169.254.1.1", "::1", "fd00::1", "fe80::1"]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("accepts public addresses", () => {
    for (const ip of ["104.16.1.1", "172.32.0.1", "2606:4700::6810:1", "8.8.8.8"]) {
      expect(isPublicIp(ip), ip).toBe(true);
    }
  });
});

describe("toHeaderMap", () => {
  it("lowercases names and joins repeated headers", () => {
    expect(
      toHeaderMap([
        { name: "Server", value: "nginx" },
        { name: "Via", value: "1.1 a" },
        { name: "via", value: "1.1 b" },
        { name: "X-Empty" },
      ]),
    ).toEqual({ server: "nginx", via: "1.1 a, 1.1 b", "x-empty": "" });
  });
});

describe("detectFromHeaders", () => {
  it("recognizes Cloudflare from cf-ray and the server header as one signal", () => {
    const signals = detectFromHeaders({ server: "cloudflare", "cf-ray": "8c1-MXP" });
    expect(signals).toEqual([{ category: "cdn", provider: "Cloudflare", evidence: ["cf-ray header"] }]);
  });

  it("layers CDN, hosting and server software", () => {
    const signals = detectFromHeaders({
      via: "1.1 abc.cloudfront.net (CloudFront)",
      "x-amz-cf-id": "xyz",
      server: "AmazonS3",
    });
    expect(providers(signals)).toEqual(["Amazon CloudFront", "Amazon S3"]);
  });

  it("reports the web server with its version", () => {
    expect(detectFromHeaders({ server: "nginx/1.25.3" })).toEqual([
      { category: "server", provider: "nginx", evidence: ["server: nginx/1.25.3"] },
    ]);
  });

  it("matches the GitHub Pages server header exactly", () => {
    expect(providers(detectFromHeaders({ server: "GitHub.com" }))).toEqual(["GitHub Pages"]);
    expect(detectFromHeaders({ server: "github.com-proxy" })).toEqual([]);
  });

  it("returns nothing for unknown headers", () => {
    expect(detectFromHeaders({ "content-type": "text/html" })).toEqual([]);
  });
});

describe("DNS-based detection", () => {
  it("matches CNAME targets, ignoring case and trailing dots", () => {
    expect(providers(detectFromCnames(["D111.CloudFront.net.", "example.netlify.app"]))).toEqual([
      "Amazon CloudFront",
      "Netlify",
    ]);
  });

  it("collapses all nameservers of one provider into a single signal", () => {
    const signals = detectFromNameservers(["ns-1.awsdns-01.org.", "ns-2.awsdns-02.com."]);
    expect(signals).toHaveLength(1);
    expect(signals[0].provider).toBe("Amazon Route 53");
    expect(signals[0].evidence).toHaveLength(2);
  });

  it("recognizes Cloudflare and OVHcloud nameservers", () => {
    expect(providers(detectFromNameservers(["ada.ns.cloudflare.com"]))).toEqual(["Cloudflare"]);
    expect(providers(detectFromNameservers(["dns200.anycast.me"]))).toEqual(["OVHcloud"]);
  });

  it("parses MX records and detects the inbound provider", () => {
    expect(parseMx("10 ASPMX.L.GOOGLE.COM.")).toEqual({ priority: 10, host: "aspmx.l.google.com" });
    expect(providers(detectFromMx(["mx1.mail.ovh.net", "mx2.mail.ovh.net"]))).toEqual(["OVHcloud"]);
  });
});

describe("TXT parsing", () => {
  it("joins split character-strings and unescapes quotes", () => {
    expect(parseTxt('"v=spf1 include:_spf.google.com " "~all"')).toBe("v=spf1 include:_spf.google.com ~all");
    expect(parseTxt('"say \\"hi\\""')).toBe('say "hi"');
    expect(parseTxt("unquoted")).toBe("unquoted");
  });

  it("extracts SPF includes only from the SPF record", () => {
    const txt = ["google-site-verification=abc", "v=spf1 include:_spf.google.com include:sendgrid.net -all"];
    expect(spfIncludes(txt)).toEqual(["_spf.google.com", "sendgrid.net"]);
    expect(spfIncludes(["include:not-spf.example"])).toEqual([]);
  });

  it("detects senders and verified SaaS", () => {
    const signals = detectFromTxt([
      "v=spf1 include:spf.protection.outlook.com include:mail.zendesk.com -all",
      "MS=ms12345678",
      "atlassian-domain-verification=xyz",
      "unrelated",
    ]);
    expect(signals.map((s) => `${s.category}:${s.provider}`)).toEqual([
      "sender:Microsoft 365",
      "sender:Zendesk",
      "saas:Microsoft 365",
      "saas:Atlassian",
    ]);
  });
});

describe("mergeSignals", () => {
  it("merges evidence without duplicates and keeps inputs untouched", () => {
    const a = { category: "cdn" as const, provider: "Fastly", evidence: ["x"] };
    const merged = mergeSignals([a, { ...a, evidence: ["x", "y"] }]);
    expect(merged).toEqual([{ category: "cdn", provider: "Fastly", evidence: ["x", "y"] }]);
    expect(a.evidence).toEqual(["x"]);
  });
});

describe("summarizeRdap", () => {
  it("extracts network, registrant and CIDR", () => {
    const summary = summarizeRdap("104.16.1.1", {
      name: "CLOUDFLARENET",
      country: "US",
      cidr0_cidrs: [{ v4prefix: "104.16.0.0", length: 13 }],
      entities: [
        { roles: ["abuse"], vcardArray: ["vcard", [["fn", {}, "text", "Abuse Desk"]]] },
        { roles: ["registrant"], vcardArray: ["vcard", [["fn", {}, "text", "Cloudflare, Inc."]]] },
      ],
    });
    expect(summary).toEqual({
      ip: "104.16.1.1",
      name: "CLOUDFLARENET",
      organization: "Cloudflare, Inc.",
      country: "US",
      range: "104.16.0.0/13",
    });
  });

  it("falls back to the address range when there is no CIDR", () => {
    const summary = summarizeRdap("2.3.4.5", { startAddress: "2.0.0.0", endAddress: "2.15.255.255" });
    expect(summary.range).toBe("2.0.0.0 - 2.15.255.255");
    expect(summary.organization).toBeNull();
  });
});

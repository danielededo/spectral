import { type DohFixture, expect, section, test } from "./fixtures";

const record = (name: string, type: number, data: string) => ({ name, type, TTL: 300, data });

const DOH: DohFixture = {
  A: {
    Status: 0,
    Answer: [record("localhost", 5, "cname.vercel-dns.com."), record("cname.vercel-dns.com", 1, "76.76.21.21")],
  },
  AAAA: { Status: 0 },
  SOA: { Status: 0, Authority: [record("example.it.", 6, "ada.ns.cloudflare.com. dns.cloudflare.com. 1 2 3 4 5")] },
  NS: { Status: 0, Answer: [record("example.it", 2, "ada.ns.cloudflare.com."), record("example.it", 2, "bob.ns.cloudflare.com.")] },
  MX: { Status: 0, Answer: [record("example.it", 15, "1 mx1.mail.ovh.net."), record("example.it", 15, "5 mx2.mail.ovh.net.")] },
  TXT: {
    Status: 0,
    Answer: [
      record("example.it", 16, '"v=spf1 include:mx.ovh.com include:sendgrid.net " "~all"'),
      record("example.it", 16, '"google-site-verification=abc"'),
    ],
  },
  CAA: { Status: 0, Answer: [record("example.it", 257, '0 issue "letsencrypt.org"')] },
  "TXT _dmarc.example.it": {
    Status: 0,
    Answer: [record("_dmarc.example.it", 16, '"v=DMARC1; p=quarantine; pct=50; rua=mailto:abc@rua.easydmarc.eu"')],
  },
  "TXT _mta-sts.example.it": { Status: 0, Answer: [record("_mta-sts.example.it", 16, '"v=STSv1; id=20260901"')] },
  "TXT _smtp._tls.example.it": { Status: 0 },
};

const RDAP = {
  name: "VERCEL-NET",
  country: "US",
  cidr0_cidrs: [{ v4prefix: "76.76.21.0", length: 24 }],
  entities: [{ roles: ["registrant"], vcardArray: ["vcard", [["fn", {}, "text", "Vercel, Inc"]]] }],
};

test("reports every section from headers, DNS and RDAP", async ({ site, mockLookups, openPanel, rdapRequests }) => {
  await mockLookups(DOH, RDAP);
  const popup = await openPanel(await site({ server: "nginx/1.25.3", "cf-ray": "8c1abc-MXP", "x-vercel-id": "fra1::abc" }));

  await expect(popup.locator("#host")).toContainText("HTTP 200");

  const edge = section(popup, "Edge and hosting");
  await expect(edge).toContainText("Cloudflare");
  await expect(edge).toContainText("cf-ray header");
  await expect(edge).toContainText("x-vercel-id header · CNAME cname.vercel-dns.com");
  await expect(edge).toContainText("server: nginx/1.25.3");

  const network = section(popup, "Network");
  await expect(network).toContainText("VERCEL-NET");
  await expect(network).toContainText("Vercel, Inc");
  await expect(network).toContainText("76.76.21.0/24");
  expect(rdapRequests).toEqual(["https://rdap.org/ip/76.76.21.21"]);

  const dns = section(popup, "DNS");
  await expect(dns).toContainText("example.it");
  await expect(dns).toContainText("NS ada.ns.cloudflare.com · NS bob.ns.cloudflare.com");
  await expect(dns).toContainText('0 issue "letsencrypt.org"');

  const mail = section(popup, "Email");
  await expect(mail).toContainText("OVHcloud");
  await expect(mail).toContainText("SPF include sendgrid.net");
  await expect(mail).toContainText("~all: other senders soft-fail");
  await expect(mail).toContainText("quarantine, applied to 50% of mail");
  await expect(mail).toContainText("EasyDMARC");
  await expect(mail).toContainText("report address @rua.easydmarc.eu");
  await expect(mail).toContainText("published (policy id 20260901)");
  await expect(mail).toContainText("TLS-RPTnot published");

  await expect(section(popup, "Verified services")).toContainText("Google Search Console");
});

test("keeps header findings when lookups fail", async ({ site, mockLookups, openPanel }) => {
  await mockLookups("fail");
  const popup = await openPanel(await site({ "cf-ray": "8c1abc-MXP" }));

  await expect(section(popup, "Edge and hosting")).toContainText("Cloudflare");
  for (const title of ["Network", "DNS", "Email", "Verified services"]) {
    await expect(section(popup, title)).toContainText("Lookup failed");
  }
});

test("renders record data as text, never as markup", async ({ site, mockLookups, openPanel }) => {
  const payload = "<img src=x onerror=window.pwned=1>.example.";
  await mockLookups({ ...DOH, A: { Status: 0, Answer: [record("localhost", 5, payload)] } }, RDAP);
  const popup = await openPanel(await site({}));

  await expect(section(popup, "Edge and hosting")).toContainText("<img src=x onerror=window.pwned=1>.example");
  expect(await popup.locator("img").count()).toBe(0);
  expect(await popup.evaluate(() => "pwned" in window)).toBe(false);
});

test("asks for a website on non-web tabs", async ({ openPanel }) => {
  const popup = await openPanel("chrome://extensions/");
  await expect(popup.locator("#host")).toHaveText("Open a website (http or https) to inspect it.");
  await expect(popup.locator("section")).toHaveCount(0);
  await expect(popup.getByRole("tablist")).toBeHidden();
});

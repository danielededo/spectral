# ADR 0002: Ship spectral as a client-only browser extension

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** repository maintainer

## Context

Spectral reveals data about a website that is tedious to collect by hand:
which CDN and hosting sit in front of it, who owns the network, which
provider runs its DNS and email, which SaaS the domain is verified with. The
first question is where that work runs. A backend would allow raw WHOIS,
TLS handshakes and caching, but it costs money, needs operating, and turns
the tool into a service that sees every domain its users inspect.

Most of the data is reachable from the browser: response headers through the
`webRequest` API, DNS through DNS-over-HTTPS, and IP ownership through RDAP,
the JSON successor of WHOIS.

## Decision

We will ship a Manifest V3 extension with no backend. The service worker
passively records `main_frame` response headers; the popup queries
Cloudflare DoH (`cloudflare-dns.com`) and `rdap.org` only when the user opens
it. One build targets Chromium browsers, Firefox 140 or later and Firefox
for Android 142 or later.

## Options considered

### Option 1: Client-only extension

- Pros: zero hosting cost and operations; no server that aggregates browsing
  data; simple to review for store submission.
- Cons: no TLS certificate details on Chrome (the API exists only in
  Firefox); no shared cache, so every popup open repeats the lookups; the
  DoH resolver and RDAP bootstrap see the inspected domain and IP.

### Option 2: Extension plus hosted API

- Pros: WHOIS over port 43, certificate inspection, caching and rate
  limiting in one place.
- Cons: hosting cost, uptime and abuse handling; users must trust the
  operator with the list of sites they inspect.

## Consequences

Features that need a raw socket (certificate chain on Chrome, port-43
WHOIS, port scans) are out of scope until this decision is superseded. The
README must state which third parties receive which data. If a backend
becomes necessary, it is added for that feature only, behind a new ADR.

## References

- [RFC 8484](https://www.rfc-editor.org/rfc/rfc8484) DNS queries over HTTPS
- [RFC 9082](https://www.rfc-editor.org/rfc/rfc9082) RDAP query format
- [Cloudflare DoH JSON API](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/)

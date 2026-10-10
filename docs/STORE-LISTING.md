# Store listing

Everything a browser extension store asks for, written once. The Edge column
is what Microsoft Partner Center asks for; Chrome Web Store and Firefox AMO
ask for nearly the same.

## Package

```
npm ci
npm run build
```

Zip the **contents** of `dist/` (the `manifest.json` at the root of the
archive, not inside a folder). The result for `0.1.0` is about 21 KB and
holds nine files. `store/*.zip` is ignored by git.

The version in the store is the `version` of `public/manifest.json`; it must
increase with every upload.

## Texts

**Name:** Spectral

**Short description** (123 characters):

> See what runs behind any website: CDN, hosting, tech stack, network owner, DNS and email setup, with the evidence for each.

**Description:**

> Spectral shows what runs behind the site in your current tab. Click the icon and read, in three swipeable pages:
>
> Site: the CDN, hosting platform, WAF and web server, and the frameworks, CMS, libraries, analytics and third-party services the page is built with, with versions when the page exposes them.
>
> Network: the connected IP, A and AAAA records, and who owns the network (RDAP): name, organization, address range, country and registered address.
>
> Email: the DNS provider, MX records, SPF and DMARC policy, MTA-STS and TLS-RPT, and the services the domain has verified ownership with.
>
> Every finding comes with the header, DNS record or page element that proves it.
>
> Privacy: no account, no analytics, no server of its own. Page analysis and response headers stay in your browser (headers only in session storage, one entry per tab, deleted when the tab closes). When you open the popup, the hostname is looked up on Cloudflare DNS over HTTPS and the site's IP on RDAP. Nothing else leaves your device.

**Category:** Developer tools

**Search terms:** tech stack, cdn, dns, whois, rdap, spf, dmarc, headers

**Privacy policy URL:** https://spectral.danielededo.it/privacy

**Website / support URL:** https://github.com/danielededo/spectral (the repository must be public for this to work; until then use the policy page)

## Single purpose

Show the user what infrastructure and technology is behind the website in
the active tab.

## Permission justifications

| Permission | Why |
| --- | --- |
| `webRequest` (with `http://*/*`, `https://*/*`) | Read the response headers and the connected IP address of each top-level page load. The CDN, hosting and server findings come from them. Spectral only reads; it never blocks, redirects or changes a request. Only main frames are observed. |
| `scripting` | Run a small read-only inspection in the tab the user opened the popup on, to read the generator meta tag, script and stylesheet URLs and a fixed list of well-known globals. |
| `storage` | Keep the captured headers of each tab in session storage so the popup can show them. Entries are removed when the tab closes. |
| Host permissions `http://*/*`, `https://*/*` | The extension must inspect whichever site the user is on, so the host cannot be narrowed to a list. |

No remote code is loaded or executed. The extension contacts two services,
both only after the user opens the popup, and sends them public identifiers
only: the site's hostname and registrable domain (`cloudflare-dns.com`) and
one IP address of the site (`rdap.org`). See the
[policy](https://spectral.danielededo.it/privacy).

## Notes for certification

> Open any website, click the Spectral icon. Findings appear on the Site,
> Network and Email pages (swipe, use the dots, or the arrow keys). No account
> or setup is needed. Pages that are not websites (the browser's own pages)
> show a message instead of findings. Source code and build steps are in the
> repository README.

## Images

In `store/edge/`, generated from the real popup on a public website:

| File | Size | Use |
| --- | --- | --- |
| `logo-300.png` | 300 x 300 | Store logo |
| `screenshot-1.png` to `screenshot-3.png` | 1280 x 800 | Site, Network and Email pages |

The small promotional tile (440 x 280) is optional and not provided.

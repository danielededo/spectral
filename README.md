# spectral

A browser extension that shows what runs behind the site in your current tab:
the CDN and hosting in front of it, who owns the IP network, which provider
serves its DNS and email, and which SaaS the domain has verified ownership
with. Each finding comes with the header or DNS record that proves it.

Status: early development, not yet published on any store.

## Features

The Infrastructure panel is the first module. It groups findings into five
sections:

- Edge and hosting: CDN, hosting platform, WAF and web server, from response
  headers and the CNAME chain.
- Network: connected IP, A and AAAA records, and the RDAP network name, owner,
  range and country.
- DNS: zone apex, DNS provider recognized from the nameservers, NS and CAA
  records.
- Email: inbound provider from MX records and outbound senders from SPF
  includes.
- Verified services: SaaS inferred from domain verification TXT records.

## Installation

```
npm ci
npm run build
```

Chrome: open `chrome://extensions`, enable Developer mode, choose Load
unpacked and select `dist/`.

Firefox (140 or later): open `about:debugging#/runtime/this-firefox`, choose
Load Temporary Add-on and select `dist/manifest.json`, or run
`npm run firefox:run`. Firefox treats host permissions as optional, so grant
"Access your data for all websites" from the extension's permissions page.

Firefox for Android (142 or later): enable USB debugging on the phone and
remote debugging in Firefox settings, connect it, find its id with
`adb devices`, then run `npm run firefox:android -- --android-device=<id>`.
The popup opens full width from the Extensions entry of the browser menu.

Other mobile browsers cannot run it: Chrome for Android and iOS has no
extension support, and Safari would need a native app wrapper.

`npm run firefox:lint` validates the build against Mozilla's add-on rules.
The only expected warning is the ignored `background.service_worker` key,
which Chrome uses while Firefox uses `background.scripts`.

Response headers are captured while a page loads, so reload tabs that were
already open before the extension was installed.

## Privacy

Spectral has no backend and sends no telemetry. When you open the popup it
makes these requests, and only these:

| Service | Receives | Purpose |
| --- | --- | --- |
| `cloudflare-dns.com` | the site's hostname and zone apex | DNS-over-HTTPS lookups of A, AAAA, SOA, NS, MX, TXT and CAA |
| `rdap.org` and the regional registry it redirects to | one IP address of the site | network owner lookup |

Captured response headers stay in the browser's session storage, one entry
per tab, deleted when the tab closes or the browser quits.

Because the hostname of the inspected site leaves the browser, the Firefox
manifest declares the `browsingActivity` data collection category, which
Firefox shows to the user at install time.

## Development

```
npm run check      # typecheck and unit tests
npm run dev        # rebuild dist/ on change
npm run test:e2e   # load dist/ in Chromium and drive the popup (build first)
npm run icons      # regenerate public/icons/ from scripts/icon.svg
```

The end-to-end tests need Playwright's Chromium, installed once with
`npx playwright install chromium`, or an existing binary passed through the
`CHROMIUM_PATH` environment variable. They serve a local fixture site and
mock the DoH and RDAP responses, so they run offline.

Fingerprints live in `src/infrastructure/detect.ts` as pure rules with unit
tests; see [AGENTS.md](AGENTS.md) for the architecture and conventions, and
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Structure

```
/
├── README.md                       # this file
├── AGENTS.md                       # AI agent instructions (single source of truth)
├── CLAUDE.md                       # pointer to AGENTS.md
├── CONTRIBUTING.md                 # contribution workflow
├── CODE_OF_CONDUCT.md              # Contributor Covenant
├── SECURITY.md                     # how to report vulnerabilities
├── CHANGELOG.md                    # Keep a Changelog + SemVer
├── package.json                    # scripts and dev dependencies
├── tsconfig.json
├── vite.config.ts                  # builds popup and service worker into dist/
├── playwright.config.ts            # end-to-end test runner
├── public/
│   ├── manifest.json               # Manifest V3, shared by Chrome and Firefox
│   └── icons/                      # generated PNGs, 16 to 128 px
├── scripts/
│   ├── icon.svg                    # icon source
│   └── render-icons.ts             # renders icon.svg into public/icons/
├── e2e/
│   ├── fixtures.ts                 # extension context, fixture site, lookup mocks
│   ├── infrastructure.e2e.ts
│   └── tsconfig.json
├── src/
│   ├── background.ts               # service worker: captures main_frame responses
│   ├── shared/
│   │   └── capture.ts              # per-tab capture in storage.session
│   ├── infrastructure/
│   │   ├── detect.ts               # fingerprint rules and parsers (pure)
│   │   ├── detect.test.ts
│   │   └── lookup.ts               # DNS-over-HTTPS and RDAP clients
│   └── popup/
│       ├── index.html
│       ├── main.ts                 # renders the Infrastructure panel
│       └── style.css
├── licenses/                       # license candidates; pick one, move to ./LICENSE
│   ├── MIT.txt
│   ├── APACHE-2.0.txt
│   └── PROPRIETARY.txt
├── docs/
│   ├── LICENSE-GUIDE.md            # how to choose a license
│   ├── README-TEMPLATE.md          # README skeleton
│   ├── REPO-SETTINGS.md            # GitHub settings checklist
│   ├── BRANCHING-STRATEGY.md       # trunk-based/GitHub Flow vs release-based
│   ├── COMMIT-CONVENTION.md        # Conventional Commits, with examples
│   ├── AI-AGENTS.md                # guidelines for CLAUDE.md / AGENTS.md
│   └── adr/
│       ├── README.md               # what ADRs are and the index
│       ├── 0000-template.md
│       ├── 0001-trunk-based-development.md
│       └── 0002-client-only-extension.md
└── .github/
    ├── CODEOWNERS
    ├── PULL_REQUEST_TEMPLATE.md
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   ├── feature_request.md
    │   └── config.yml
    ├── dependabot.yml              # npm and GitHub Actions updates
    └── workflows/
        └── ci.yml                  # check, build, Firefox lint and end-to-end tests
```

## License

[TO BE FILLED IN: pick a license from `licenses/` following
[docs/LICENSE-GUIDE.md](docs/LICENSE-GUIDE.md).]

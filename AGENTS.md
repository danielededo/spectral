# spectral

Browser extension (Manifest V3; Chromium browsers, Firefox, Firefox for
Android) that shows the infrastructure behind the site in the active tab:
CDN, hosting, tech stack, network owner, DNS provider, email providers and
domain-verified SaaS. It runs entirely
client-side; there is no backend. See [ADR 0002](docs/adr/0002-client-only-extension.md).

This file is the single source of truth for agent instructions, as prescribed
by [docs/AI-AGENTS.md](docs/AI-AGENTS.md); `CLAUDE.md` is a pointer to it.

## Commands

- Install: `npm ci` (Node 22 or later).
- Validate: `npm run check` (typecheck and unit tests; always run after editing).
- Build: `npm run build` writes the unpacked extension to `dist/`.
- End-to-end: `npm run test:e2e` drives the built extension in Chromium with
  a fixture site and mocked DoH and RDAP; run it after `npm run build`. Set
  `CHROMIUM_PATH` to use an existing Chromium instead of Playwright's.
- Icons: `npm run icons` regenerates `public/icons/` from `scripts/icon.svg`;
  commit both.
- Watch: `npm run dev` rebuilds `dist/` on change; reload the extension in the browser.
- Firefox: `npm run firefox:lint` validates `dist/` for AMO (after a build);
  `npm run firefox:run` and `npm run firefox:android -- --android-device=<id>`
  launch it.

## Architecture

- `src/background.ts` is the service worker. It only observes `main_frame`
  responses through `webRequest.onCompleted` and stores headers, status and
  connected IP per tab in `chrome.storage.session` (`src/shared/capture.ts`).
- `src/popup/` renders the panel. It reads the capture for the active tab and
  runs DNS-over-HTTPS and RDAP lookups (`src/infrastructure/lookup.ts`) only
  when the user opens the popup. Sections live on three pages (Site, Network,
  Email) in a horizontally scroll-snapped strip; `src/popup/pager.ts` keeps
  the labelled dots, which follow the ARIA tabs pattern, in sync with it.
- `src/infrastructure/detect.ts` holds every fingerprint rule and all parsing
  as pure functions; `detect.test.ts` covers them. New providers are added as
  rules there, each with a test. Email authentication policies (SPF, DMARC,
  MTA-STS, TLS-RPT) are parsed and described in `src/infrastructure/mail.ts`.
  The MTA-STS policy file itself is not fetched: that would be a request to
  the inspected domain, a new endpoint under the boundary below.
- `src/techstack/probe.ts` is injected with `chrome.scripting.executeScript`
  into the page's main world when the popup opens, so it can read globals such
  as `jQuery.fn.jquery`. It must stay self-contained (it is serialized), must
  not throw, and reads only the globals and selectors listed by the rules.
  Its result is untrusted: `normalizeSnapshot` validates the shape and
  `cleanVersion` keeps only version-shaped strings. Technology rules live in
  `src/techstack/detect.ts`, each with a test.
- `e2e/` covers the wiring between service worker, storage and popup. The
  popup's `chrome.tabs.query` is stubbed there because a popup opened as a
  page would otherwise be its own active tab. A change to what the popup
  renders comes with an end-to-end assertion.

## Conventions

- Commits: Conventional Commits; see [docs/COMMIT-CONVENTION.md](docs/COMMIT-CONVENTION.md).
  Scopes in use: `infra`, `techstack`, `popup`, `background`, `build`.
- Branching: trunk-based; see [docs/BRANCHING-STRATEGY.md](docs/BRANCHING-STRATEGY.md)
  and [ADR 0001](docs/adr/0001-trunk-based-development.md).
- All content (docs, comments, commit messages, file names) is written in
  English, no exceptions.
- TypeScript strict mode, no UI framework. The popup builds the DOM with
  `textContent` only: data from headers, DNS and RDAP is untrusted and must
  never reach `innerHTML`.
- A fingerprint needs evidence the user can check (a header name, a record);
  it is shown next to the provider. Prefer no detection over a guess.

## Writing style

These rules apply to any text produced in this repository, by humans and
agents alike: documentation, commit messages, pull request and issue text,
code comments.

- Prefer prose. Use bullet or numbered lists only when the content is
  genuinely enumerable or sequential (options, checklists, step-by-step
  procedures), not as a default layout for explanations.
- Start with the substance. No filler or throat-clearing phrases
  ("as you can see", "it's worth noting", "let me explain").
- No generic disclaimers, hedging boilerplate, or pseudo-human tone (fake
  enthusiasm, apologies, self-narration). State facts and uncertainty plainly.
- No emoji and no arrow glyphs anywhere. No decorative formatting: headings
  and tables belong to documents that need structure, not to short texts;
  in running prose avoid bold for emphasis. In new prose prefer commas,
  colons, or separate sentences over em dashes.
- Commit messages are plain text: no markdown syntax at all.
- Numbered sections and closing summaries only where the document type calls
  for them (a guide with a procedure), never as reflex.

## Boundaries

- Never commit directly to `main`; every change goes through a pull request.
- No backend and no telemetry. The only network calls are the DoH and RDAP
  lookups listed in the README; adding another endpoint needs an ADR.
- Keep permissions minimal. Adding a manifest permission or host pattern must
  be justified in the pull request description.
- `LICENSE` (MIT) and the body of `CODE_OF_CONDUCT.md` are canonical
  third-party texts: never reword them.
- When adding, renaming, or removing files, update the structure tree in
  `README.md` in the same pull request.

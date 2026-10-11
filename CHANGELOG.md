# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
How to use this file:

- Add every user-visible change under "Unreleased", in the appropriate category:
  Added, Changed, Deprecated, Removed, Fixed, Security.
- When releasing, rename "Unreleased" to the new version and date
  (e.g. "[1.2.0] - 2026-08-23"), then start a fresh "Unreleased" section on top.
- Keep entries short, in plain language, written for users, not commit messages.
- Link versions to the corresponding GitHub compare/tag URLs at the bottom.
-->

## [Unreleased]

## [0.1.1] - 2026-10-11

### Fixed

- Separate packages for Chromium browsers and Firefox, each declaring only
  its own background key, so the Edge Add-ons store accepts the package.

## [0.1.0] - 2026-10-11

### Added

- Infrastructure panel: CDN, hosting, WAF and web server from response
  headers and CNAMEs; network owner via RDAP; DNS provider, MX and SPF
  senders, CAA and domain-verified SaaS via DNS-over-HTTPS.
- Network section: the network owner's registered address (city and region),
  when the registry publishes it. It is where the network is registered, not
  where the server physically is.
- Email security in the Email section: SPF policy, DMARC policy and its
  report collector, MTA-STS and TLS-RPT.
- Tech stack section: CMS, frameworks, libraries, UI kits, analytics,
  commerce, consent and third-party services, with versions when exposed.
- Popup split into three pages, Site, Network and Email, with labelled dots,
  swipe and arrow-key navigation.
- Firefox for Android support, with a full-width popup on touch screens.
- Extension icons.
- Released under the MIT License.

[Unreleased]: https://github.com/danielededo/spectral/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/danielededo/spectral/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/danielededo/spectral/releases/tag/v0.1.0

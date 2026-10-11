# Security Policy

Spectral is maintained by a solo developer. Security reports are taken
seriously, but response times are best-effort, not backed by a dedicated
security team.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Instead, use GitHub private vulnerability reporting: go to the **Security**
tab of this repository and click **Report a vulnerability**.

A useful report includes:

- A description of the vulnerability and its impact
- Steps to reproduce, or a proof of concept if you have one
- The affected version, commit, or branch
- Any suggestions you have for a fix (optional, but appreciated)

## What to expect

- **Acknowledgement** of your report within a few days (usually faster).
- An honest assessment: whether the issue is confirmed, its severity, and a rough
  timeline for a fix. Simple issues are usually fixed quickly; complex ones may
  take longer; you'll be kept in the loop.
- **Credit** in the release notes or changelog when the fix ships, unless you
  prefer to stay anonymous.

Please give a reasonable window to ship a fix before disclosing the issue
publicly. Coordinated disclosure protects users of the project.

## Supported versions

Only the **latest release** (and the `main` branch) receive security fixes.
Store versions are updated to the latest release.

## Scope notes

- Vulnerabilities in third-party dependencies should be reported upstream first;
  a report here is still welcome if this project needs to update or mitigate.
- Findings that require physical access to the maintainer's machine, social
  engineering, or denial of service by sheer volume are generally out of scope.

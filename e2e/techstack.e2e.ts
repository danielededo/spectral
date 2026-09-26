import { expect, section, test } from "./fixtures";

const PAGE = `
  <meta name="generator" content="WordPress 6.5.2">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
  <script src="/wp-content/themes/demo/jquery-3.7.1.min.js"></script>
  <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST"></script>
  <script>window.jQuery = { fn: { jquery: "3.7.1" } }; window.React = { version: "18.3.1" };</script>
  <div id="__next"></div>
  <app-root ng-version="17.3.0"></app-root>
`;

test.beforeEach(async ({ context }) => {
  // Keep third-party URLs referenced by the fixture page offline.
  await context.route(/^https:\/\/(cdn\.jsdelivr\.net|www\.googletagmanager\.com)\//, (route) => route.fulfill({ body: "" }));
});

test("detects the stack from the page and the response headers", async ({ site, mockLookups, openPanel }) => {
  await mockLookups("fail");
  const popup = await openPanel(await site({ "x-powered-by": "PHP/8.2.12" }, PAGE));

  const tech = section(popup, "Tech stack");
  await expect(tech).toContainText("WordPress 6.5.2");
  await expect(tech).toContainText("generator: WordPress 6.5.2 · script /wp-content/themes/demo/jquery-3.7.1.min.js");
  await expect(tech).toContainText("jQuery 3.7.1");
  await expect(tech).toContainText("React 18.3.1");
  await expect(tech).toContainText("Next.js");
  await expect(tech).toContainText("Angular 17.3.0");
  await expect(tech).toContainText("Bootstrap 5.3.2");
  await expect(tech).toContainText("Google Tag Manager");
  await expect(tech).toContainText("PHP 8.2.12");
  await expect(tech).not.toContainText("does not let extensions read this page");
});

test("survives a page that sabotages DOM and globals", async ({ site, mockLookups, openPanel }) => {
  await mockLookups("fail");
  const hostile = `
    <script>
      Object.defineProperty(window, "jQuery", { get() { throw new Error("no"); } });
      window.React = { version: "<img src=x onerror=window.pwned=1>" };
      Document.prototype.querySelectorAll = () => { throw new Error("no"); };
    </script>`;
  const popup = await openPanel(await site({ "x-powered-by": "Express" }, hostile));

  const tech = section(popup, "Tech stack");
  await expect(tech).toContainText("Express");
  await expect(tech).toContainText("React");
  await expect(tech).not.toContainText("onerror");
  await expect(tech).not.toContainText("jQuery");
  expect(await popup.locator("img").count()).toBe(0);
  expect(await popup.evaluate(() => "pwned" in window)).toBe(false);
});

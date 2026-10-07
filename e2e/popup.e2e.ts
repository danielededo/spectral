import { expect, section, test } from "./fixtures";

test("pages through the panel with tabs, arrow keys and swipes", async ({ site, mockLookups, openPanel }) => {
  await mockLookups("fail");
  const popup = await openPanel(await site({ "cf-ray": "8c1abc-MXP" }));
  const tab = (name: string) => popup.getByRole("tab", { name });

  await expect(tab("Site")).toHaveAttribute("aria-selected", "true");
  await expect(section(popup, "Edge and hosting")).toBeInViewport();
  await expect(section(popup, "Email")).not.toBeInViewport();

  await tab("Email").click();
  await expect(tab("Email")).toHaveAttribute("aria-selected", "true");
  await expect(tab("Site")).toHaveAttribute("aria-selected", "false");
  await expect(section(popup, "Email")).toBeInViewport();
  await expect(section(popup, "Edge and hosting")).not.toBeInViewport();

  await popup.keyboard.press("ArrowLeft");
  await expect(tab("Network")).toHaveAttribute("aria-selected", "true");
  await expect(section(popup, "DNS")).toBeInViewport();
  await expect(tab("Network")).toBeFocused();

  // A touch swipe ends as a horizontal scroll of the page strip.
  await popup.locator("#pages").evaluate((pages) => pages.scrollTo({ left: 0 }));
  await expect(tab("Site")).toHaveAttribute("aria-selected", "true");
  await expect(section(popup, "Tech stack")).toBeInViewport();

  await popup.keyboard.press("ArrowLeft");
  await expect(tab("Site")).toHaveAttribute("aria-selected", "true");
});

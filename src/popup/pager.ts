export function setupPager(pages: HTMLElement, tabs: HTMLButtonElement[]): void {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const current = () => Math.round(pages.scrollLeft / Math.max(pages.clientWidth, 1));

  const select = (index: number) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
  };

  const go = (index: number) => {
    const target = Math.max(0, Math.min(tabs.length - 1, index));
    pages.scrollTo({ left: target * pages.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    select(target);
    if (tabs.includes(document.activeElement as HTMLButtonElement)) tabs[target].focus();
  };

  tabs.forEach((tab, i) => tab.addEventListener("click", () => go(i)));
  pages.addEventListener("scroll", () => select(current()), { passive: true });
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight") go(current() + 1);
    else if (event.key === "ArrowLeft") go(current() - 1);
    else return;
    event.preventDefault();
  });
}

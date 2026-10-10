export function setupPager(pages: HTMLElement, tabs: HTMLButtonElement[]): void {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // While a programmatic scroll is in flight, scrollLeft is somewhere between
  // two pages. Navigate relative to where that scroll is heading instead, so a
  // key press during the animation does not bounce back to the page it left.
  let pending: number | null = null;
  const current = () => pending ?? Math.round(pages.scrollLeft / Math.max(pages.clientWidth, 1));

  // Desktop popups size #pages to the active page so a short page does not
  // inherit the height of the tallest one. Mobile fills the screen via flex.
  const fillsScreen = matchMedia("(pointer: coarse)");
  const fit = () => {
    const active = pages.children[current()] as HTMLElement | undefined;
    pages.style.height = fillsScreen.matches || !active ? "" : `${active.offsetHeight}px`;
  };
  let scrolling = false;
  const resizeObserver = new ResizeObserver(() => {
    if (!scrolling) fit();
  });
  Array.from(pages.children).forEach((page) => resizeObserver.observe(page));
  // Changing the height while the strip is scrolling makes scroll-snap restart
  // the animation, so refit only once scrolling has settled. Every new scroll
  // re-arms the timer, so a pending refit can never land mid-animation.
  let settle: ReturnType<typeof setTimeout> | undefined;
  const fitWhenSettled = () => {
    scrolling = true;
    clearTimeout(settle);
    settle = setTimeout(() => {
      scrolling = false;
      pending = null;
      // A swipe that ended while a programmatic scroll was pending is only
      // reflected in scrollLeft now, so re-read the tabs from the real position.
      select(current());
      fit();
    }, 120);
  };

  const select = (index: number) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
  };

  const go = (index: number) => {
    const target = Math.max(0, Math.min(tabs.length - 1, index));
    pending = target;
    fitWhenSettled();
    pages.scrollTo({ left: target * pages.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    select(target);
    if (tabs.includes(document.activeElement as HTMLButtonElement)) tabs[target].focus();
  };

  tabs.forEach((tab, i) => tab.addEventListener("click", () => go(i)));
  pages.addEventListener(
    "scroll",
    () => {
      select(current());
      fitWhenSettled();
    },
    { passive: true },
  );
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight") go(current() + 1);
    else if (event.key === "ArrowLeft") go(current() - 1);
    else return;
    event.preventDefault();
  });
}

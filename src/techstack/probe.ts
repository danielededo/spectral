export interface PageSnapshot {
  generators: string[];
  scripts: string[];
  stylesheets: string[];
  globals: Record<string, string | true>;
  markers: Record<string, string | true>;
}

export type MarkerQuery = [selector: string, attribute: string | null];

// Serialized by chrome.scripting into the page's main world: it must stay self-contained and never throw.
export function probePage(globalPaths: string[], markerQueries: MarkerQuery[]): PageSnapshot {
  const LIMIT = 200;
  const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 300) : "");
  const urls = (selector: string, attribute: string) => {
    const out: string[] = [];
    try {
      for (const node of Array.from(document.querySelectorAll(selector)).slice(0, LIMIT)) {
        const value = text(node.getAttribute(attribute));
        if (value) out.push(value);
      }
    } catch {
      // A hostile page can break DOM APIs; an empty list is the safe answer.
    }
    return out;
  };

  const globals: Record<string, string | true> = {};
  for (const path of globalPaths) {
    try {
      let value: unknown = window;
      for (const key of path.split(".")) value = (value as Record<string, unknown> | null | undefined)?.[key];
      if (typeof value === "string" || typeof value === "number") globals[path] = String(value).slice(0, 64);
      else if (value) globals[path] = true;
    } catch {
      // Getters on the page may throw; treat as absent.
    }
  }

  const markers: Record<string, string | true> = {};
  for (const [selector, attribute] of markerQueries) {
    try {
      const node = document.querySelector(selector);
      if (node) markers[selector] = attribute ? text(node.getAttribute(attribute)).slice(0, 64) || true : true;
    } catch {
      // Unsupported selectors in older engines are treated as absent.
    }
  }

  return {
    generators: urls('meta[name="generator" i]', "content"),
    scripts: urls("script[src]", "src"),
    stylesheets: urls('link[rel~="stylesheet" i][href]', "href"),
    globals,
    markers,
  };
}

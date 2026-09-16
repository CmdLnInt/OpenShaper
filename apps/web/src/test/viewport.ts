/**
 * A `matchMedia` jsdom can use to answer the editor's layout queries.
 *
 * jsdom ships a `matchMedia` that reports `false` for everything, which meant
 * every layout tier was "not desktop, not phone" — so the component tests were
 * all exercising the middle tier by accident rather than by intent, and a test
 * could not ask for a phone at all.
 *
 * This evaluates the only forms the app uses — min/max width and height, and
 * comma-separated lists of them — against a viewport the test sets. It is not a
 * media-query engine: anything else it does not understand evaluates to false,
 * loudly enough to notice because the layout will be wrong.
 */

// Tablet portrait: neither desktop (≥1024 wide) nor phone. jsdom's `false`-to-
// everything matchMedia put the existing tests on exactly this tier, so it stays
// the default — installing a real evaluator should not quietly relayout 39 test
// files. Tests that care declare a tier with `setTier`.
const DEFAULT = { width: 834, height: 1112 };

let viewport = { ...DEFAULT };
const listeners = new Set<() => void>();

const FEATURE = /\(\s*(min|max)-(width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*\)/g;

/** Evaluate one comma-separated media query list against the current viewport. */
function evaluate(query: string): boolean {
  // A query list matches if ANY of its comma-separated queries matches; each
  // query matches only if ALL of its features do.
  return query.split(',').some((part) => {
    const features = [...part.matchAll(FEATURE)];
    if (features.length === 0) return false;
    return features.every(([, bound, axis, raw]) => {
      const value = axis === 'width' ? viewport.width : viewport.height;
      const limit = Number(raw);
      return bound === 'min' ? value >= limit : value <= limit;
    });
  });
}

/** Point the stubbed `matchMedia` at a viewport size and notify subscribers. */
export function setViewport(width: number, height: number): void {
  viewport = { width, height };
  for (const notify of [...listeners]) notify();
}

/** Named tiers, so a test says which layout it means rather than picking pixels. */
export const VIEWPORTS = {
  phone: [360, 780],
  phoneLandscape: [844, 390],
  tablet: [834, 1112],
  desktop: [1280, 800],
} as const satisfies Record<string, readonly [number, number]>;

export function setTier(tier: keyof typeof VIEWPORTS): void {
  const [w, h] = VIEWPORTS[tier];
  setViewport(w, h);
}

/** Install the stub. Called once from `setup.ts`. */
export function installMatchMedia(): void {
  window.matchMedia = ((query: string) => {
    const self = {
      media: query,
      get matches() {
        return evaluate(query);
      },
      onchange: null,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      // Deprecated API, still used by some libraries.
      addListener: (fn: () => void) => listeners.add(fn),
      removeListener: (fn: () => void) => listeners.delete(fn),
      dispatchEvent: () => false,
    };
    return self as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** Reset between tests so a tier never leaks into the next one. */
export function resetViewport(): void {
  viewport = { ...DEFAULT };
  listeners.clear();
}

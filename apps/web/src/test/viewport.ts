/**
 * A `matchMedia` jsdom can use to answer the editor's layout queries.
 *
 * jsdom ships a `matchMedia` that reports `false` for everything, which meant
 * every layout tier was "not desktop, not phone" — so the component tests were
 * all exercising the middle tier by accident rather than by intent, and a test
 * could not ask for a phone at all.
 *
 * This evaluates the forms the app uses — min/max width and height, orientation,
 * and comma-separated lists of them — against a viewport the test sets. It is not
 * a media-query engine: any other feature evaluates to false, loudly enough to
 * notice because the layout will be wrong.
 */

// Tablet portrait: neither desktop (≥1024 wide) nor phone. jsdom's `false`-to-
// everything matchMedia put the existing tests on exactly this tier, so it stays
// the default — installing a real evaluator should not quietly relayout 39 test
// files. Tests that care declare a tier with `setTier`.
const DEFAULT = { width: 834, height: 1112 };

let viewport = { ...DEFAULT };
const listeners = new Set<() => void>();

const SIZE = /\(\s*(min|max)-(width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*\)/;
const ORIENTATION = /\(\s*orientation\s*:\s*(portrait|landscape)\s*\)/;
/** Any parenthesised feature, so an unrecognised one can be told from none at all. */
const ANY_FEATURE = /\([^)]*\)/g;

/** Evaluate a single `(feature: value)` against the current viewport. */
function feature(text: string): boolean {
  const size = SIZE.exec(text);
  if (size) {
    const [, bound, axis, raw] = size;
    const value = axis === 'width' ? viewport.width : viewport.height;
    return bound === 'min' ? value >= Number(raw) : value <= Number(raw);
  }
  const orientation = ORIENTATION.exec(text);
  if (orientation) {
    // CSS calls a square viewport portrait.
    const portrait = viewport.height >= viewport.width;
    return orientation[1] === 'portrait' ? portrait : !portrait;
  }
  return false;
}

/** Evaluate one comma-separated media query list against the current viewport. */
function evaluate(query: string): boolean {
  // A query list matches if ANY of its comma-separated queries matches; each
  // query matches only if ALL of its features do.
  return query.split(',').some((part) => {
    const features = part.match(ANY_FEATURE);
    if (!features) return false;
    return features.every(feature);
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

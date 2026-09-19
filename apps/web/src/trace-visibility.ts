// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Per-view trace visibility — hide a trace without losing it.
 *
 * Trace images are the one thing in the editor that belongs to the *shaper*
 * rather than the board: they live in their own IndexedDB store, survive
 * loading a different board, and are deliberately not written into any board
 * file. Which is exactly why accepting a shared board has to hide them. The
 * recipient's own outline trace sitting under a stranger's outline is a
 * wrong-picture bug, and deleting their scan to avoid it would be worse.
 *
 * So visibility is separate, lightweight state: a flag per view in
 * localStorage, with the image bytes in trace-store.ts untouched. Turning a
 * trace back on is one checkbox.
 *
 * Absent state means visible. An existing user's traces must not vanish the
 * first time they load a build that has this file in it.
 */
import type { TraceView } from './trace-store';

const STORAGE_KEY = 'bs.traceVisible';

/** Bump when the stored shape changes in a breaking way. */
export const TRACE_VISIBILITY_VERSION = 1;

export type TraceVisibility = Record<TraceView, boolean>;

/** Both visible — what a browser with nothing stored gets. */
export const DEFAULT_TRACE_VISIBILITY: TraceVisibility = { outline: true, rocker: true };

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/**
 * Read the stored flags. A missing key, a malformed blob, a version mismatch or
 * a locked localStorage all mean "visible" — the safe direction, since an
 * invisible trace with no way to guess why is the worse failure.
 */
export function loadTraceVisibility(): TraceVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TRACE_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<TraceVisibility> & { version?: number };
    if (!parsed || parsed.version !== TRACE_VISIBILITY_VERSION) {
      return { ...DEFAULT_TRACE_VISIBILITY };
    }
    return {
      outline: bool(parsed.outline, true),
      rocker: bool(parsed.rocker, true),
    };
  } catch {
    return { ...DEFAULT_TRACE_VISIBILITY };
  }
}

/** Persist the flags. Storage failures are swallowed, as everywhere else here. */
export function saveTraceVisibility(v: TraceVisibility): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...v, version: TRACE_VISIBILITY_VERSION }));
  } catch {
    // QuotaExceededError or private browsing — the flags degrade to "visible".
  }
}

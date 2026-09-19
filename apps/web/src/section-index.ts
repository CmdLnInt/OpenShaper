// SPDX-License-Identifier: GPL-3.0-or-later
import { getLength, type BezierBoard } from '@openshaper/kernel';

/**
 * Clamp a cross-section index to the board's real, selectable stations.
 *
 * Index 0 and the last index are the nose/tail dummies, so the selectable range
 * is 1..count-2. The active index is raw state that survives edits, and deleting
 * a station leaves it pointing past the end — deriving through this on every
 * render is what keeps the selection (and the 3D highlight) on a station that
 * exists.
 */
export const clampSectionIndex = (csIndex: number, sectionCount: number): number => {
  const lastReal = Math.max(1, sectionCount - 2);
  return Math.min(Math.max(csIndex, 1), lastReal);
};

/**
 * The real station nearest the board-length midpoint, with the lower index
 * winning a tie.
 *
 * Where a shared board opens. The midpoint is the one station that means the
 * same thing on every board — the widest part of most outlines, and the one a
 * shaper judges a shape by — whereas whatever station the *sender* happened to
 * have selected is an artifact of their editing session, not a view of the board.
 */
export const nearestMidpointSection = (board: BezierBoard): number => {
  const mid = getLength(board) / 2;
  const lastReal = board.crossSections.length - 2;
  let best = 1;
  let bestDistance = Infinity;
  for (let i = 1; i <= lastReal; i += 1) {
    // Strictly less-than, so an exact tie keeps the first (lower) index.
    const distance = Math.abs(board.crossSections[i]!.position - mid);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return clampSectionIndex(best, board.crossSections.length);
};

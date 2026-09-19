// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { knot, splineFromKnots, vec2, type BezierBoard } from '@openshaper/kernel';
import { clampSectionIndex, nearestMidpointSection } from './section-index';

// `sectionCount` counts ALL cross-sections, including the nose/tail dummies at
// index 0 and the last index. Real, selectable stations are 1..count-2.
describe('clampSectionIndex', () => {
  it('leaves a valid index alone', () => {
    expect(clampSectionIndex(2, 6)).toBe(2);
  });

  it('clamps down when the active station is deleted', () => {
    // 6 sections → real 1..4. Delete one: 5 sections → real 1..3.
    expect(clampSectionIndex(4, 5)).toBe(3);
  });

  it('never selects a nose/tail dummy', () => {
    expect(clampSectionIndex(0, 6)).toBe(1);
    expect(clampSectionIndex(-3, 6)).toBe(1);
  });

  it('degrades to 1 for a board with no real stations', () => {
    expect(clampSectionIndex(3, 2)).toBe(1);
    expect(clampSectionIndex(3, 0)).toBe(1);
  });

  it('is stable when a station is added', () => {
    expect(clampSectionIndex(3, 6)).toBe(3);
    expect(clampSectionIndex(3, 7)).toBe(3);
  });
});

describe('nearestMidpointSection', () => {
  /** A board whose stations sit at the given positions, in a 200 cm length. */
  const boardWith = (positions: number[]) =>
    ({
      outline: splineFromKnots([
        knot(vec2(0, 0), vec2(0, 0), vec2(0, 0), true, false),
        knot(vec2(200, 0), vec2(200, 0), vec2(200, 0), true, false),
      ]),
      crossSections: positions.map((p) => ({ position: p, spline: splineFromKnots([]) })),
    }) as unknown as BezierBoard;

  it('picks the real station nearest the midpoint', () => {
    // 200 cm board, midpoint 100. Dummies at each end are never selectable.
    expect(nearestMidpointSection(boardWith([0, 40, 90, 150, 200]))).toBe(2);
  });

  it('takes the lower index on an exact tie', () => {
    // 80 and 120 are both 20 cm from the midpoint — the first wins.
    expect(nearestMidpointSection(boardWith([0, 80, 120, 200]))).toBe(1);
  });

  it('handles an odd number of real stations', () => {
    expect(nearestMidpointSection(boardWith([0, 25, 50, 100, 150, 175, 200]))).toBe(3);
  });

  it('ignores the nose and tail dummies even when they are nearest', () => {
    // A degenerate board whose dummies sit at the midpoint: the answer must
    // still be a station the editor can actually select.
    const index = nearestMidpointSection(boardWith([100, 10, 190, 100]));
    expect(index).toBeGreaterThanOrEqual(1);
    expect(index).toBeLessThanOrEqual(2);
  });

  it('degrades to 1 when there are no real stations', () => {
    expect(nearestMidpointSection(boardWith([0, 200]))).toBe(1);
  });
});

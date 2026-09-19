import { describe, expect, it } from 'vitest';
import { orthographicZoomFor, upForViewDirection } from './view-framing';

describe('orthographicZoomFor', () => {
  it('fits the span across 80% of the viewport width', () => {
    // 1000px across a 200cm board: 80% of 1000px = 800px of board, so 4 px/cm.
    expect(orthographicZoomFor(1000, 200)).toBeCloseTo(4, 10);
    const span = 187.96;
    expect(orthographicZoomFor(1106, span) * span).toBeCloseTo(1106 * 0.8, 6);
  });

  it('scales with the viewport and inversely with the span', () => {
    expect(orthographicZoomFor(2000, 200)).toBeCloseTo(orthographicZoomFor(1000, 200) * 2, 10);
    expect(orthographicZoomFor(1000, 400)).toBeCloseTo(orthographicZoomFor(1000, 200) / 2, 10);
  });

  it('never returns a zoom that would collapse the projection', () => {
    // A zero/negative zoom degenerates the orthographic matrix and the board vanishes.
    for (const [w, span] of [
      [0, 200],
      [1000, Infinity],
      [-100, 200],
      [1000, 1e9],
    ] as const)
      expect(orthographicZoomFor(w, span)).toBeGreaterThan(0);
  });
});

describe('upForViewDirection', () => {
  // Board axes: X tail->nose, Y rail->rail, Z vertical.
  it('keeps the deck upright for profile and isometric views', () => {
    for (const d of [
      { z: 0 }, // dead-on nose / tail / rail
      { z: 0.5 }, // isometric
      { z: -0.7071 }, // 45° from below
      { z: 0.998 }, // steep, but not quite down the axis
    ])
      expect(upForViewDirection(d)).toEqual([0, 0, 1]);
  });

  it('hands "up" to Y when looking along Z, where Z is useless as up', () => {
    expect(upForViewDirection({ z: 1 })).toEqual([0, 1, 0]); // deck view, from above
    expect(upForViewDirection({ z: -1 })).toEqual([0, -1, 0]); // bottom view, from below
  });

  it('puts the nose on the right of the screen from both deck and bottom', () => {
    // screen-right = forward x up, with forward = -direction (the camera looks back
    // toward the board). Both must come out as +X, the nose.
    const cross = (a: number[], b: number[]) => [
      a[1]! * b[2]! - a[2]! * b[1]!,
      a[2]! * b[0]! - a[0]! * b[2]!,
      a[0]! * b[1]! - a[1]! * b[0]!,
    ];
    for (const z of [1, -1]) {
      const forward = [0, 0, -z]; // camera sits at +z*d, looks toward the origin
      const right = cross(forward, upForViewDirection({ z }));
      expect(right[0]).toBeGreaterThan(0); // +X = nose, on the right
      expect(right[1]).toBeCloseTo(0, 10);
      expect(right[2]).toBeCloseTo(0, 10);
    }
  });
});

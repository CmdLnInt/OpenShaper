/**
 * Pure framing maths for the 3D view.
 *
 * Split out of `Board3DView` so it can be tested without a WebGL context: the
 * component file pulls in three, fiber and drei, none of which belong in a unit
 * test of two arithmetic rules.
 */

/**
 * Orthographic zoom that fits `span` cm across ~80% of a `viewportWidth`-px view.
 *
 * An orthographic camera has no distance-driven scale, so framing is entirely this
 * number. Clamped above zero: a zero or negative zoom collapses the projection
 * matrix and the board vanishes.
 */
export const orthographicZoomFor = (viewportWidth: number, span: number): number =>
  Math.max(0.01, viewportWidth / (span * 1.25));

/**
 * The camera's up vector when snapping to a view along `direction`.
 *
 * Board axes are X tail→nose, Y rail→rail, Z vertical. Looking straight down or up
 * the Z axis (deck and bottom views) leaves Z useless as "up", so Y takes over —
 * signed so the nose stays on the right of the screen from both. Every other view
 * keeps the deck upright with Z.
 */
export const upForViewDirection = (direction: { z: number }): [number, number, number] =>
  Math.abs(direction.z) > 0.999 ? [0, Math.sign(direction.z), 0] : [0, 0, 1];

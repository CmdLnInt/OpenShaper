import type { Vec2 } from '@openshaper/kernel';

/**
 * Maps world coordinates (board centimeters, y-up) to screen pixels (y-down).
 * `scale` is pixels per cm; `(originX, originY)` is the screen pixel at world (0,0).
 */
export interface Viewport {
  readonly scale: number;
  readonly originX: number;
  readonly originY: number;
}

/**
 * CSS reference scale: pixels per centimetre at 1:1 (life-size).
 *
 * CSS defines exactly 1 in = 96 px (the "reference pixel") and 1 in = 2.54 cm,
 * therefore 1 cm = 96 / 2.54 ≈ 37.795 CSS px.
 *
 * Note: this is the CSS *reference* pixel anchor, not a calibrated physical
 * measurement. On high-DPI monitors the backing-store canvas is scaled by
 * `devicePixelRatio` (handled separately in the canvas `setTransform` call)
 * but the viewport scale is always in CSS px — do NOT multiply by dpr here.
 * Whether 1 CSS px truly equals one physical pixel depends on the monitor's
 * actual PPI; per-monitor calibration is left as future work.
 */
export const CSS_PX_PER_CM: number = 96 / 2.54;

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export const worldToScreen = (vp: Viewport, p: Vec2): ScreenPoint => ({
  x: vp.originX + p.x * vp.scale,
  y: vp.originY - p.y * vp.scale,
});

export const screenToWorld = (vp: Viewport, s: ScreenPoint): Vec2 => ({
  x: (s.x - vp.originX) / vp.scale,
  y: (vp.originY - s.y) / vp.scale,
});

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Compute a viewport that fits `bounds` (with px padding) centered in the canvas. */
export const fitToBounds = (
  bounds: Bounds,
  canvasW: number,
  canvasH: number,
  padding = 24,
): Viewport => {
  const w = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const h = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const scale = Math.min((canvasW - 2 * padding) / w, (canvasH - 2 * padding) / h);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    originX: canvasW / 2 - cx * scale,
    originY: canvasH / 2 + cy * scale,
  };
};

/**
 * Would these bounds fit larger in a canvas with its axes swapped?
 *
 * The editor's 2D views are length-wise: a surfboard is about 4:1, so in a pane
 * that is taller than it is wide the fit is decided by the *width* and most of
 * the height goes unused. Drawing the board turned nose-up trades one limit for
 * the other. Measured on a 334x451 phone pane, that is 1.52 -> 2.14 px/cm.
 *
 * Expressed as "is the transposed fit bigger" rather than as a shape test, so it
 * can never make a pane worse: in a wide pane a 4:1 board is already
 * height-limited and this answers false, which is the case that matters — turning
 * there would cost a factor of 3.6.
 *
 * Note the arguments are the *canvas* dimensions in both calls; the caller swaps
 * them when it acts on a true answer.
 */
export const turnFitsLarger = (
  bounds: Bounds,
  canvasW: number,
  canvasH: number,
  padding = 24,
): boolean =>
  fitToBounds(bounds, canvasH, canvasW, padding).scale >
  fitToBounds(bounds, canvasW, canvasH, padding).scale;

/**
 * The two directions of the board turn's quarter rotation.
 *
 * When a pane draws the board nose-up, the canvas ELEMENT is rotated -90° about its
 * own top-left and slid down by its width, so it covers a pane whose axes are the
 * swapped pair. The canvas's own coordinate space stays ordinary and unrotated —
 * that is the whole point, and it is why nothing else in this package has to know
 * the turn exists.
 *
 * These are the only two functions that do. `canvasW` is the canvas's own width,
 * i.e. the pane's *height*. Exported as a pair so the editor and the tests that
 * drive it cannot drift: a mapping that is right in one and wrong in the other
 * shows up as "the point does not follow my finger", silently.
 */
export const paneToTurnedCanvas = (p: ScreenPoint, canvasW: number): ScreenPoint => ({
  x: canvasW - p.y,
  y: p.x,
});

/** Inverse of {@link paneToTurnedCanvas}. */
export const turnedCanvasToPane = (p: ScreenPoint, canvasW: number): ScreenPoint => ({
  x: p.y,
  y: canvasW - p.x,
});

/**
 * Size-independent framing: the world point under the canvas center plus the
 * zoom. Unlike Viewport (whose origin is a pixel offset), this survives being
 * restored into a different canvas/window size, so it is what gets persisted.
 */
export interface ViewCenter {
  readonly cx: number;
  readonly cy: number;
  /** Pixels per cm, same meaning as Viewport.scale. */
  readonly scale: number;
}

/** Build a viewport that puts `c`'s world center under the canvas center. */
export const viewportFromCenter = (c: ViewCenter, canvasW: number, canvasH: number): Viewport => ({
  scale: c.scale,
  originX: canvasW / 2 - c.cx * c.scale,
  originY: canvasH / 2 + c.cy * c.scale,
});

/** The world point currently under the canvas center, with the zoom. */
export const viewportCenter = (vp: Viewport, canvasW: number, canvasH: number): ViewCenter => {
  const world = screenToWorld(vp, { x: canvasW / 2, y: canvasH / 2 });
  return { cx: world.x, cy: world.y, scale: vp.scale };
};

/** Zoom by `factor` about a screen anchor, keeping that point fixed. */
export const zoomAt = (vp: Viewport, anchor: ScreenPoint, factor: number): Viewport => {
  const world = screenToWorld(vp, anchor);
  const scale = vp.scale * factor;
  return {
    scale,
    originX: anchor.x - world.x * scale,
    originY: anchor.y + world.y * scale,
  };
};

export const pan = (vp: Viewport, dxPx: number, dyPx: number): Viewport => ({
  ...vp,
  originX: vp.originX + dxPx,
  originY: vp.originY + dyPx,
});

/**
 * Return a viewport zoomed to 1:1 (life-size) with the canvas centre held fixed.
 *
 * The resulting `scale` is exactly `CSS_PX_PER_CM` (≈ 37.795 CSS px per cm).
 * The world point that was under the canvas centre before the call remains under
 * the canvas centre after the call — i.e. the zoom is anchored at the centre of
 * the visible canvas area.
 *
 * `canvasW` / `canvasH` are the CSS-pixel dimensions of the canvas element (not
 * the backing-store dimensions, which are multiplied by devicePixelRatio).
 */
export const lifeSizeViewport = (current: Viewport, canvasW: number, canvasH: number): Viewport =>
  zoomAt(current, { x: canvasW / 2, y: canvasH / 2 }, CSS_PX_PER_CM / current.scale);

/**
 * Carry a framing across a canvas resize without re-zooming.
 *
 * `fitToBounds` is the wrong response to a resize: it throws away whatever the
 * user had panned/zoomed to and re-frames from scratch. This keeps the world
 * point under the canvas centre and the zoom exactly as they were, so a pane
 * that grows or shrinks (a header wrapping onto a second row, an orientation
 * change) only reveals or hides margin.
 *
 * Note that the point under a *given screen pixel* still shifts by half the size
 * delta — the centre is what is held. Callers mid-gesture want the screen<->world
 * mapping frozen instead, i.e. to leave the viewport untouched entirely.
 */
export const reframeForSize = (
  vp: Viewport,
  prevW: number,
  prevH: number,
  nextW: number,
  nextH: number,
): Viewport => viewportFromCenter(viewportCenter(vp, prevW, prevH), nextW, nextH);

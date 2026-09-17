/** jsdom shims for the component tests. */
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { installMatchMedia, resetViewport } from './viewport';

// Testing Library's auto-cleanup needs a global afterEach; we run without
// vitest globals, so unmount between tests explicitly.
afterEach(cleanup);

// jsdom's own matchMedia answers `false` to everything, so every layout tier
// read as "not desktop, not phone" and the component tests exercised the middle
// tier by accident. This one answers against a viewport a test can set — see
// `setTier` in ./viewport. The default is desktop.
installMatchMedia();
afterEach(resetViewport);

// SplineEditor sizes its canvas with a ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no canvas implementation; SplineEditor handles a null 2D context,
// so return null quietly instead of jsdom's noisy "not implemented" error.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// jsdom implements pointer events but not pointer capture, which SplineEditor
// uses to keep a drag alive when the pointer leaves the canvas.
HTMLElement.prototype.setPointerCapture ??= function setPointerCapture() {};
HTMLElement.prototype.releasePointerCapture ??= function releasePointerCapture() {};
HTMLElement.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};

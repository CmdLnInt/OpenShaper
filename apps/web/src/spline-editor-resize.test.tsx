/**
 * Regression: a canvas resize must never move the screen<->world mapping out from
 * under a gesture that is already in flight.
 *
 * On phones, grabbing a control point selects it, which used to wrap the pane
 * header onto a second row, which shrank the canvas, which re-fitted the viewport
 * — so the held point teleported and every later move wrote a wrong position.
 */
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installLayoutStubs,
  mountEditor,
  MOUSE,
  removeLayoutStubs,
  resizeTo,
  shiftTo,
} from './test/spline-editor-harness';

beforeEach(installLayoutStubs);
afterEach(removeLayoutStubs);

describe('SplineEditor: the canvas changing shape mid-drag', () => {
  it('leaves the grabbed point where it is when the pane shrinks mid-drag', () => {
    const { store, canvas, screenOf, midKnot } = mountEditor();
    const grab = screenOf(midKnot());

    fireEvent.pointerDown(canvas, { ...MOUSE, ...grab });
    expect(store.getState().selection).toEqual({
      target: { kind: 'outline' },
      index: 1,
      kind: 'end',
    });
    const before = midKnot();

    // The pane loses a header row while the pointer is still down, then the
    // pointer reports the same position it went down at.
    resizeTo(600, 356);
    fireEvent.pointerMove(canvas, { ...MOUSE, ...grab });

    const after = midKnot();
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('translates pointer motion 1:1 after a mid-drag resize', () => {
    const { canvas, screenOf, midKnot, scale } = mountEditor();
    const grab = screenOf(midKnot());
    const pxPerCm = scale();

    fireEvent.pointerDown(canvas, { ...MOUSE, ...grab });
    const before = midKnot();

    resizeTo(600, 356);
    fireEvent.pointerMove(canvas, {
      ...MOUSE,
      clientX: grab.clientX + 10 * pxPerCm,
      clientY: grab.clientY,
    });

    // The mapping is frozen for the drag, so 10 cm of pixels is still 10 cm.
    const after = midKnot();
    expect(after.x - before.x).toBeCloseTo(10, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('ignores a mid-drag layout shift that moves the canvas without resizing it', () => {
    // A maximized pane does exactly this: the header grows a row and pushes the
    // canvas down, so no ResizeObserver fires and only the client rect moves.
    const { canvas, screenOf, midKnot } = mountEditor();
    const grab = screenOf(midKnot());

    fireEvent.pointerDown(canvas, { ...MOUSE, ...grab });
    const before = midKnot();

    shiftTo(25);
    fireEvent.pointerMove(canvas, { ...MOUSE, ...grab });

    const after = midKnot();
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('carries the framing over on a resize with no drag in flight', () => {
    const { canvas, screenOf, midKnot, scale } = mountEditor();
    const fitted = scale();

    // Zoom in first, so a re-fit would be plainly visible: the fitted scale here is
    // width-constrained, and a height-only resize leaves it untouched.
    fireEvent.wheel(canvas, { deltaY: -1, clientX: 300, clientY: 200 });
    const zoomed = scale();
    expect(zoomed).toBeCloseTo(fitted * 1.1, 6);

    resizeTo(600, 356);

    // The user's zoom survives the resize — a resize is not a re-fit.
    expect(scale()).toBeCloseTo(zoomed, 6);
    // ...and the point is still grabbable at wherever it now sits.
    const grab = screenOf(midKnot());
    fireEvent.pointerDown(canvas, { ...MOUSE, ...grab });
    fireEvent.pointerMove(canvas, {
      ...MOUSE,
      clientX: grab.clientX + 10 * zoomed,
      clientY: grab.clientY,
    });
    expect(midKnot().x).toBeCloseTo(60, 6);
  });
});

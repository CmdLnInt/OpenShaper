/**
 * Regression: a canvas resize must never move the screen<->world mapping out from
 * under a gesture that is already in flight.
 *
 * On phones, grabbing a control point selects it, which used to wrap the pane
 * header onto a second row, which shrank the canvas, which re-fitted the viewport
 * — so the held point teleported and every later move wrote a wrong position.
 * That made editing a board on a touch device effectively impossible.
 */
import {
  board,
  crossSection,
  knot,
  splineFromKnots,
  vec2,
  type BezierBoard,
  type Vec2,
} from '@openshaper/kernel';
import {
  SplineEditor,
  viewportFromCenter,
  worldToScreen,
  type ViewCenter,
} from '@openshaper/render2d';
import { createBoardStore } from '@openshaper/store';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const makeBoard = (): BezierBoard => {
  const k = (ex: number, ey: number) => knot(vec2(ex, ey), vec2(ex - 5, ey), vec2(ex + 5, ey));
  const prof = splineFromKnots([
    knot(vec2(0, 5), vec2(0, 5), vec2(10, 5)),
    knot(vec2(10, 8), vec2(10, 6), vec2(10, 8)),
  ]);
  return board(
    splineFromKnots([k(0, 0), k(50, 20), k(100, 0)]),
    splineFromKnots([k(0, 5), k(100, 5)]),
    splineFromKnots([k(0, 11), k(100, 11)]),
    [crossSection(0, prof), crossSection(50, prof), crossSection(100, prof)],
  );
};

/** The live size of the editor's container, driven by the test. */
let paneW = 600;
let paneH = 400;
/** Where the canvas sits on the page — a growing header pushes this down. */
let paneTop = 0;
/** ResizeObserver callbacks registered by the component under test. */
let observers: ResizeObserverCallback[] = [];

/** Resize the pane the way a wrapping header used to, and flush the observer. */
const resizeTo = (w: number, h: number) => {
  paneW = w;
  paneH = h;
  act(() => {
    for (const cb of observers) cb([], {} as ResizeObserver);
  });
};

class TestResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    observers.push(this.cb);
  }
  unobserve() {}
  disconnect() {
    observers = observers.filter((c) => c !== this.cb);
  }
}

const realRO = globalThis.ResizeObserver;
const protos = [HTMLDivElement.prototype, HTMLCanvasElement.prototype];
const saved = protos.map((p) => ({
  p,
  descriptors: (['clientWidth', 'clientHeight', 'getBoundingClientRect'] as const).map(
    (name) => [name, Object.getOwnPropertyDescriptor(p, name)] as const,
  ),
}));

beforeEach(() => {
  observers = [];
  paneW = 600;
  paneH = 400;
  paneTop = 0;
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
  for (const p of protos) {
    Object.defineProperty(p, 'clientWidth', { configurable: true, get: () => paneW });
    Object.defineProperty(p, 'clientHeight', { configurable: true, get: () => paneH });
    Object.defineProperty(p, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: paneTop,
        right: paneW,
        bottom: paneTop + paneH,
        width: paneW,
        height: paneH,
      }),
    });
  }
});

afterEach(() => {
  globalThis.ResizeObserver = realRO;
  for (const { p, descriptors } of saved) {
    for (const [name, d] of descriptors) {
      if (d) Object.defineProperty(p, name, d);
      else delete (p as unknown as Record<string, unknown>)[name];
    }
  }
});

/**
 * Mount the outline editor over a loaded board. `screenOf` maps world cm to canvas
 * pixels through the framing the editor last reported, so the tests never have to
 * hard-code the result of `fitToBounds`.
 */
const mountEditor = () => {
  const store = createBoardStore();
  act(() => store.getState().load(makeBoard()));
  let view: ViewCenter | null = null;
  const rendered = render(
    <SplineEditor
      store={store}
      targets={[{ kind: 'outline' }]}
      colors={['#fff']}
      onViewChange={(v) => {
        view = v;
      }}
    />,
  );
  const canvas = rendered.container.querySelector('canvas')!;
  const screenOf = (world: Vec2) => {
    const s = worldToScreen(viewportFromCenter(view!, paneW, paneH), world);
    return { clientX: s.x, clientY: s.y + paneTop };
  };
  const midKnot = () => store.getState().board!.outline.knots[1]!.end;
  return { store, canvas, screenOf, midKnot, scale: () => view!.scale };
};

const MOUSE = { pointerId: 1, button: 0, pointerType: 'mouse' } as const;

describe('SplineEditor: resize during a control-point drag', () => {
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

    act(() => {
      paneTop = 25;
    });
    fireEvent.pointerMove(canvas, { ...MOUSE, ...grab });

    // Same screen position, so the point must not have moved.
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

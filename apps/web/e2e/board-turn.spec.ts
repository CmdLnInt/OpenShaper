import { expect, test, type Page } from '@playwright/test';
import { editorReady } from './helpers';

/**
 * The board is drawn nose-up where that fits it larger.
 *
 * A surfboard is about 4:1, so in a pane taller than it is wide the fit is decided
 * by the width and most of the height goes unused. Turning trades one limit for the
 * other: measured on the 334x451 pane a 360x780 phone gives the maximized outline
 * view, 1.52 -> 2.14 px/cm, for no gesture and no setting.
 *
 * It is a CSS rotation on the canvas ELEMENT, so the canvas keeps an ordinary
 * unrotated coordinate space and every hit test and draw routine is untouched.
 * jsdom has no layout engine and no CSS transforms, so whether the rotation is
 * actually applied — and to which panes — can only be checked in a real browser.
 */

interface Pane {
  /** The canvas's own drawing surface, in CSS px. */
  canvas: { w: number; h: number };
  /** The box it occupies on the page. */
  box: { w: number; h: number };
  turned: boolean;
}

async function pane(page: Page): Promise<Pane> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) throw new Error('no canvas in the editor pane');
    const box = c.getBoundingClientRect();
    const turned = getComputedStyle(c).transform !== 'none';
    // The backing store is the canvas's own size times devicePixelRatio. Turned, the
    // element's page box has its axes swapped relative to that space, so the ratio
    // has to be taken against the matching side or it reads as a bogus dpr.
    const dpr = c.width / (turned ? box.height : box.width);
    return {
      canvas: { w: Math.round(c.width / dpr), h: Math.round(c.height / dpr) },
      box: { w: Math.round(box.width), h: Math.round(box.height) },
      turned,
    };
  });
}

const VIEWS = [
  { key: '2', name: 'outline', lengthwise: true },
  { key: '3', name: 'rocker', lengthwise: true },
  { key: '4', name: 'cross-section', lengthwise: false },
] as const;

test.describe('on a portrait phone pane', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test('the length-wise views turn and the cross-section does not', async ({ page }) => {
    await page.goto('/app');
    await editorReady(page);

    for (const view of VIEWS) {
      await page.keyboard.press(view.key);
      await page.waitForTimeout(200);
      const p = await pane(page);

      expect(p.turned, `${view.name}: turned?`).toBe(view.lengthwise);
      if (view.lengthwise) {
        // The drawing surface is landscape while the box it fills is portrait —
        // that swap is what buys the scale.
        expect(p.canvas.w, `${view.name}: canvas should be laid out landscape`).toBe(p.box.h);
        expect(p.canvas.h).toBe(p.box.w);
      } else {
        // A cross-section is already the shape of the pane; turning would cost.
        expect(p.canvas.w, `${view.name}: canvas should match its box`).toBe(p.box.w);
        expect(p.canvas.h).toBe(p.box.h);
      }
    }
  });
});

test.describe('on a landscape phone pane', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('nothing turns, because turning there costs a factor of three', async ({ page }) => {
    // The case that makes the feature safe to ship without a breakpoint: a wide pane
    // already fits a 4:1 board by its height, so the predicate declines. Measured,
    // turning here would take 4.10 px/cm down to 1.14.
    await page.goto('/app');
    await editorReady(page);

    for (const view of VIEWS) {
      await page.keyboard.press(view.key);
      await page.waitForTimeout(200);
      expect((await pane(page)).turned, `${view.name} should stay upright`).toBe(false);
    }
  });
});

test.describe('on a desktop pane', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('nothing turns under a mouse, whatever the pane shape', async ({ page }) => {
    await page.goto('/app');
    await editorReady(page);
    await page.keyboard.press('2');
    await page.waitForTimeout(200);
    expect((await pane(page)).turned).toBe(false);
  });
});

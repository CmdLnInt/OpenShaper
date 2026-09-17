import { expect, test, type Page } from '@playwright/test';
import { editorReady } from './helpers';

/**
 * A maximized pane must fill the height it is given.
 *
 * `EditorPane`'s Panel is a grid item in both quad layouts and stretches on its
 * own, but a maximized pane's parent is a plain block — so without an explicit
 * height the Panel collapsed to its content and left the rest of the screen
 * empty. It cost 152px on a 1280x800 desktop and 442px of 667 on a phone, where
 * the maximized view is the one a small screen actually wants to use.
 *
 * It must also stay *visible*: the bottom sheet is fixed over the viewport
 * bottom, and a pane that fills its host all the way underneath it hides the
 * board without failing any "did it fill" assertion.
 *
 * jsdom has no layout engine, so this can only be caught in a real browser.
 */

/** Height of the pane, the space it was offered, and the canvas inside it. */
async function paneFill(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('no canvas in the maximized pane');
    const panel = canvas.closest('.rounded-lg') as HTMLElement | null;
    if (!panel?.parentElement) throw new Error('pane has no host element');
    const sheet = document.querySelector('[role=dialog][aria-label="Board panels"]');
    return {
      panel: panel.getBoundingClientRect().height,
      offered: panel.parentElement.getBoundingClientRect().height,
      canvas: canvas.getBoundingClientRect().height,
      // How far the canvas runs underneath the bottom sheet, which is fixed over
      // the viewport bottom whenever it is open.
      underSheet: sheet
        ? Math.max(0, canvas.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top)
        : 0,
    };
  });
}

const VIEWS = [
  { key: '2', name: 'outline' },
  { key: '3', name: 'rocker' },
  { key: '4', name: 'cross-section' },
] as const;

for (const viewport of [
  { name: 'phone', width: 360, height: 780 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`maximized pane at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`fills its host on ${viewport.name}`, async ({ page }) => {
      await page.goto('/app');
      await editorReady(page);

      for (const view of VIEWS) {
        await page.keyboard.press(view.key);
        await expect
          .poll(async () => Math.round((await paneFill(page)).panel), {
            message: `${view.name} pane never settled`,
          })
          .toBeGreaterThan(0);

        const { panel, offered, canvas, underSheet } = await paneFill(page);
        // Sub-pixel rounding is fine; a collapsed pane is not.
        expect(panel, `${view.name}: pane should fill its host`).toBeGreaterThan(offered - 1);
        // And the canvas should get the bulk of it, not just the header's leftovers.
        expect(canvas, `${view.name}: canvas should get most of the pane`).toBeGreaterThan(
          offered * 0.75,
        );
        // Filling the host is not the same as being visible. The pane did fill it —
        // all the way under the bottom sheet, hiding 99px of board in both
        // orientations. Nothing caught that, because nothing asked.
        expect(
          Math.round(underSheet),
          `${view.name}: canvas runs under the bottom sheet`,
        ).toBeLessThanOrEqual(1);
      }
    });
  });
}

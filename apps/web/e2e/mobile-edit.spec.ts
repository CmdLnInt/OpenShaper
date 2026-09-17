import { expect, test } from '@playwright/test';
import { editorReady } from './helpers';

/**
 * Phone-sized editing. Two things used to conspire to make control points
 * unusable on a phone: selecting a point wrapped the pane header onto a second
 * row, and the resulting canvas resize re-fitted the viewport out from under the
 * finger still holding that point. The viewport half is covered by
 * `src/spline-editor-resize.test.tsx`; the header half needs a real layout
 * engine, which is why it lives here.
 *
 * `isMobile` matters: it makes `pointer-coarse` match, which is what grows the
 * position editor's fields to the size that used to force the wrap.
 */
test.describe('editing on a phone-sized viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('selecting a control point does not resize the canvas', async ({ page }) => {
    await page.goto('/app');
    await editorReady(page);
    await page.keyboard.press('2'); // maximize the outline pane

    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);
    const before = (await canvas.boundingBox())!;

    // Where the tail knot — outline (0, 0), on the mirror centreline — is drawn.
    // The outline is framed with 24px of padding, and the fit is decided by the
    // board's long axis, so that knot sits exactly at the padding on the near end
    // of it. That makes the click deterministic instead of a blind hunt.
    //
    // Which end depends on the orientation. On a portrait phone pane the board is
    // now drawn nose-up, so it is bottom-centre rather than left-middle.
    const turned = await page.evaluate(
      () => getComputedStyle(document.querySelector('canvas')!).transform !== 'none',
    );
    const tail = turned
      ? { x: before.x + before.width / 2, y: before.y + before.height - 24 }
      : { x: before.x + 24, y: before.y + before.height / 2 };
    await page.mouse.click(tail.x, tail.y);
    await expect(page.getByLabel(/ position editor$/)).toBeVisible();

    // The position editor is now showing in the pane header. The canvas must not
    // have moved or changed size to make room for it.
    const after = (await canvas.boundingBox())!;
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });
});

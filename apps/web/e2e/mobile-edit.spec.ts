import { expect, test } from '@playwright/test';

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
    await page.getByText('Length').waitFor();
    await page.keyboard.press('2'); // maximize the outline pane

    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);
    const before = (await canvas.boundingBox())!;

    // The outline is framed with 24px of padding and is far wider than it is
    // tall, so the fit is width-constrained: the nose knot — outline (0, 0),
    // on the mirror centreline — sits exactly at the left padding, vertically
    // centred. That makes the click deterministic instead of a blind hunt.
    await page.mouse.click(before.x + 24, before.y + before.height / 2);
    await expect(page.getByLabel(/ position editor$/)).toBeVisible();

    // The position editor is now showing in the pane header. The canvas must not
    // have moved or changed size to make room for it.
    const after = (await canvas.boundingBox())!;
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });
});

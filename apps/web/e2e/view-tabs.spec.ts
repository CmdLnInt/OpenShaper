import { expect, test, type Page } from '@playwright/test';

/**
 * Every view tab must be reachable, not merely rendered.
 *
 * The tab strip is `overflow-x-auto` with `.no-scrollbar`, so a tab that does not
 * fit is still in the DOM and still passes any "is it there" assertion — it is
 * just scrolled out of sight with nothing on screen suggesting the strip scrolls
 * at all. At 360px the four tabs plus the unit selector plus the panels button
 * came to ~411px, and because the selector is `shrink-0` the strip absorbed the
 * whole overflow and swallowed the 3D tab.
 */

/** Each tab's label, and whether it sits inside the strip's visible box. */
async function tabVisibility(page: Page) {
  return page.evaluate(() => {
    const strip = document.querySelector('[role=group][aria-label=Views]');
    if (!strip) throw new Error('no view tab strip');
    const box = strip.getBoundingClientRect();
    return [...strip.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        label: (b.textContent ?? '').trim(),
        // Half a pixel of slack for sub-pixel layout; anything more is clipped.
        visible: r.left >= box.left - 0.5 && r.right <= box.right + 0.5,
      };
    });
  });
}

for (const viewport of [
  { name: 'phone portrait', width: 360, height: 780 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`view tabs at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`every tab is reachable on ${viewport.name}`, async ({ page }) => {
      await page.goto('/app');
      await page.getByText('Length').first().waitFor();

      const tabs = await tabVisibility(page);
      expect(tabs.length, 'the strip should render some tabs').toBeGreaterThan(0);

      const clipped = tabs.filter((t) => !t.visible).map((t) => t.label);
      expect(clipped, `tabs scrolled out of reach: ${clipped.join(', ')}`).toEqual([]);

      // 3D is the one that fell off, so name it explicitly rather than trusting
      // a count — a regression that drops the tab entirely would also pass above.
      expect(tabs.map((t) => t.label)).toContain('3D');
    });
  });
}

test.describe('the unit picker follows the space available', () => {
  test('sits in the toolbar on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app');
    await page.getByText('Length').first().waitFor();
    // Exactly one picker, and it is outside the bottom sheet.
    const picker = page.getByLabel('Display units');
    await expect(picker).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: 'Board panels' })).toHaveCount(0);
  });

  test('moves into the sheet on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/app');
    await page.getByText('Length').first().waitFor();

    const picker = page.getByLabel('Display units');
    await expect(picker, 'still exactly one picker, not two').toHaveCount(1);
    await expect(
      page.getByRole('dialog', { name: 'Board panels' }).getByLabel('Display units'),
      'and it lives in the sheet',
    ).toHaveCount(1);
  });
});

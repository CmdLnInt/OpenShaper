import type { Page } from '@playwright/test';

/**
 * Wait for the editor to be usable.
 *
 * Deliberately not "wait for the specs to appear": the sidebar lives in a bottom
 * sheet on compact layouts, and that sheet now starts closed on a short viewport
 * (a phone held landscape), so the spec rows are not mounted at all there. A
 * readiness signal that depends on optional chrome hangs on exactly the viewport
 * most worth testing.
 *
 * The canvas having a real size is the thing every editor test actually needs.
 */
export async function editorReady(page: Page): Promise<void> {
  await page.locator('canvas').first().waitFor();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return !!canvas && canvas.getBoundingClientRect().height > 0;
  });
}

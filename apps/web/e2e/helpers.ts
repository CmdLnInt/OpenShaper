import type { Page } from '@playwright/test';
import { SIDEBAR_SECTIONS, tabById } from '../src/sidebar-sections';

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

/**
 * Reach a sidebar tool by its section title: select its tab, then expand it.
 *
 * The sidebar is a tab strip over an accordion, so a tool is only in the DOM when its
 * tab is active and only expanded when its section is open. Which tab owns which tool
 * comes from the registry rather than each spec, so moving a tool between tabs does not
 * touch any spec. Idempotent, and a tab holding one tool renders it bare with no header
 * to click.
 */
export async function openSection(page: Page, name: string): Promise<void> {
  const section = SIDEBAR_SECTIONS.find((s) => s.title === name);
  if (!section) throw new Error(`Unknown sidebar section: ${name}`);

  const tab = page.getByRole('tab', { name: tabById(section.tab).title });
  await tab.waitFor();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();

  const header = page.getByRole('button', { name, exact: true });
  if ((await header.count()) === 0) return; // rendered bare
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
}

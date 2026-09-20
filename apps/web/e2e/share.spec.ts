import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { editorReady } from './helpers';

/**
 * The full share round-trip, in a real browser: make a link from a modified
 * board, then open it somewhere that has never seen that board.
 *
 * The recipient uses a fresh browser context deliberately. Sharing must not
 * depend on anything already in the recipient's storage — that is the whole
 * claim the feature makes, and a same-context test could pass on a board that
 * was really coming from IndexedDB.
 */

/** The headline dimensions readout (length × width × thickness) in the spec panel. */
const headlineBox = (page: Page) => page.getByRole('button', { name: 'Copy dimensions' });

async function headline(page: Page): Promise<string> {
  return (await headlineBox(page).innerText()).replace(/\s+/g, ' ').trim();
}

/** Make a link from the board currently on screen. */
async function copyShareLink(page: Page, context: BrowserContext): Promise<string> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share board' }).click();
  await expect(page.getByText(/Link size:/)).toBeVisible();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Share link copied')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test('a modified board round-trips through a link into a clean browser', async ({
  page,
  context,
  browser,
}) => {
  await page.goto('/app');
  await editorReady(page);

  // Modify the board so what arrives cannot be mistaken for the bundled sample.
  // The sidebar is visible at this viewport; the sheet toggle is lg:hidden.
  await page.getByLabel('Length').first().fill('2100');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(headlineBox(page)).toContainText('2100');

  // Name it — the dialog offers the fields when the board has none.
  await page.getByRole('button', { name: 'Share board' }).click();
  await page.getByLabel('Board model').fill('Round Trip');
  await page.getByLabel('Board designer').fill('E2E');
  await page.getByRole('button', { name: 'Cancel' }).click();

  const sent = await headline(page);
  const link = await copyShareLink(page, context);
  expect(link).toContain('/app#board=v1.');

  // --- the recipient: a context with no IndexedDB, no localStorage, nothing.
  const fresh = await browser.newContext();
  const theirPage = await fresh.newPage();
  await theirPage.goto(link);
  await editorReady(theirPage);

  // Same board.
  await expect.poll(() => headline(theirPage), { timeout: 10_000 }).toBe(sent);

  // Same Board Info, in the sidebar's own fields.
  await expect(theirPage.getByLabel(/^model$/i)).toHaveValue('Round Trip');
  await expect(theirPage.getByLabel(/^designer$/i)).toHaveValue('E2E');

  // Told what they got.
  await expect(theirPage.getByText(/Shared board opened as an editable copy/)).toBeVisible();

  // Quad view, and a clean address bar — no board in the URL for analytics,
  // the referrer or a screenshot to pick up.
  const quad = theirPage
    .getByRole('group', { name: 'Views' })
    .getByRole('button', { name: 'Quad' });
  await expect(quad).toHaveClass(/secondary/);
  expect(theirPage.url()).not.toContain('board=');
  expect(new URL(theirPage.url()).hash).toBe('');

  // And it is a working copy, not a read-only view.
  await theirPage
    .getByRole('group', { name: 'Views' })
    .getByRole('button', { name: 'Outline' })
    .click();
  await expect(theirPage.locator('canvas').first()).toBeVisible();

  await fresh.close();
});

test('an unrelated fragment and the query string survive the strip', async ({ page, context }) => {
  await page.goto('/app');
  await editorReady(page);
  const link = await copyShareLink(page, context);

  const fragment = new URL(link).hash.replace('#board=', '');
  await page.goto(`/app?utm_source=swaylocks#tab=fins&board=${fragment}`);
  await editorReady(page);

  const url = new URL(page.url());
  expect(url.search).toBe('?utm_source=swaylocks');
  expect(url.hash).toBe('#tab=fins');
});

test('a damaged link leaves the editor usable and says why', async ({ page }) => {
  await page.goto('/app#board=v1.thisisnotarealpayload');
  await editorReady(page);

  await expect(page.getByText(/damaged or incomplete/)).toBeVisible();
  // The fallback board is loaded and the payload is gone from the address bar.
  await expect(page.locator('canvas').first()).toBeVisible();
  expect(page.url()).not.toContain('board=');
});

/**
 * Naming a board while the dialog is open — the case reported from a phone.
 *
 * `named` was derived live, so with a designer already set the first character
 * typed into the model made both fields non-empty and the form collapsed to the
 * read-only line, unmounting the input. Only that character landed.
 *
 * Nothing about the cause is phone-specific — the dialog is one component at
 * every width — but the *symptom* is much louder there, because the on-screen
 * keyboard closes with the field and it reads as the dialog closing. A desktop
 * user just watches the field disappear. So both tiers run the same assertions:
 * the phone is where it was found, the desktop is where it would otherwise go
 * unnoticed.
 */
const namingSurvivesTyping = async (page: Page, openPanels: boolean) => {
  await page.goto('/app');
  await editorReady(page);

  // Set the designer first — that is what makes the next keystroke fatal.
  if (openPanels) await page.getByRole('button', { name: 'Show board panels' }).click();
  await page.getByLabel(/^designer$/i).fill('Jared');
  if (openPanels) await page.getByRole('button', { name: 'Hide board panels' }).click();

  await page.getByRole('button', { name: 'Share board' }).click();
  const field = page.getByLabel('Board model');
  await field.click();
  await page.keyboard.type('jared', { delay: 40 });

  await expect(field).toHaveValue('jared');
  await expect(field).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Share board' })).toBeVisible();
};

test('naming a board survives typing on a desktop', async ({ page }) => {
  // The sidebar is already visible at this width, so there is no sheet to open.
  await namingSurvivesTyping(page, false);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('naming a board survives typing', async ({ page }) => {
    await namingSurvivesTyping(page, true);
  });
});

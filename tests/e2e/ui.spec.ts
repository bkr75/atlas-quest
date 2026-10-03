import { DICT, currentCountry, expect, openApp, setupAndStart, test, waitNext, type Setup } from './helpers';

test('language switch flips direction and every text instantly, without reloading', async ({ page }) => {
  await openApp(page, 'ar');
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.hero h1')).toHaveText(DICT.ar.app.name);
  await expect(page.locator('.btn-start')).toContainText(DICT.ar.home.start);
  // Logical layout: in RTL the brand sits on the right.
  const brandRtl = await page.locator('.brand').boundingBox();
  expect(brandRtl!.x).toBeGreaterThan(600);

  await page.getByRole('button', { name: DICT.ar.header.switchLanguageLabel }).click();
  await expect(html).toHaveAttribute('dir', 'ltr');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(page.locator('.hero h1')).toHaveText(DICT.en.app.name);
  await expect(page.locator('.btn-start')).toContainText(DICT.en.home.start);
  await expect(page.locator('.region-chip').first()).toContainText('196 countries');
  expect(await page.evaluate(() => (window as unknown as { __marker: number }).__marker)).toBe(42);
  const brandLtr = await page.locator('.brand').boundingBox();
  expect(brandLtr!.x).toBeLessThan(100);
  await expect(page).toHaveTitle(DICT.en.app.documentTitle);
  // Focus stays on the language button after re-rendering.
  await expect(page.locator('.lang-toggle')).toBeFocused();

  await page.getByRole('button', { name: DICT.en.header.switchLanguageLabel }).click();
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.region-chip').first()).toContainText('١٩٦ دولة');
});

test('language switch during a game keeps the game and translates names', async ({ page }) => {
  await openApp(page, 'ar');
  const s: Setup = { mode: 'find', region: 'europe' };
  await setupAndStart(page, 'ar', s);
  const c = await currentCountry(page, 'ar', s);
  await expect(page.locator('.prompt-name')).toHaveText(c.ar);
  await page.locator('.lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.prompt-name')).toHaveText(c.en);
  await expect(page.locator('.prompt-text')).toContainText(`Where is ${c.en}?`);
  await expect(page.locator('.progress-text')).toHaveText('Question 1 of 10');
  // Direction-sensitive icons: the back arrow is mirrored only in RTL.
  const transformLtr = await page.locator('.btn-quit .dir-icon').evaluate((el) => getComputedStyle(el).transform);
  await page.locator('.lang-toggle').click();
  const transformRtl = await page.locator('.btn-quit .dir-icon').evaluate((el) => getComputedStyle(el).transform);
  expect(transformLtr).toBe('none');
  expect(transformRtl).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  await expect(page.locator('.progress-text')).toHaveText('السؤال ١ من ١٠');
});

test('numerals toggle switches between Arabic-Indic and Western digits', async ({ page }) => {
  await openApp(page, 'ar');
  await expect(page.locator('.region-chip').first()).toContainText('١٩٦');
  await page.locator('.numerals-toggle').click();
  await expect(page.locator('.region-chip').first()).toContainText('196 دولة');
  await expect(page.locator('.numerals-toggle')).toHaveText('123');
  await page.reload();
  await expect(page.locator('.region-chip').first()).toContainText('196 دولة');
  // Not shown in English.
  await page.locator('.lang-toggle').click();
  await expect(page.locator('.numerals-toggle')).toHaveCount(0);
});

test('theme toggle switches dark/light and is remembered', async ({ page }) => {
  await openApp(page, 'en');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: DICT.en.header.themeDark }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBg).not.toBe(lightBg);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('sound toggle is a pressed/unpressed button and is remembered', async ({ page }) => {
  await openApp(page, 'en', { muted: false });
  const btn = page.locator('.sound-toggle');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await expect(page.locator('.sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.sound-toggle')).toHaveAttribute('aria-label', DICT.en.header.soundOn);
  await page.reload();
  await expect(page.locator('.sound-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('keyboard only: choose settings, start, and answer on the map with Enter', async ({ page }) => {
  await openApp(page, 'en');
  // Radio groups are native: focus the checked mode and move with arrow keys.
  await page.locator('input[name="mode"]:checked').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name="mode"][value="type"]')).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('input[name="mode"][value="find"]')).toBeChecked();
  await page.locator('input[name="region"][value="gulf"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('input[name="region"][value="gulf"]')).toBeChecked();
  await page.locator('.btn-start').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'playing');

  const s: Setup = { mode: 'find', region: 'gulf' };
  const c = await currentCountry(page, 'en', s);
  const target = page.locator(`path.country[data-id="${c.id}"]`);
  await expect(target).toHaveAttribute('tabindex', '0');
  await expect(target).toHaveAttribute('role', 'button');
  await target.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toHaveClass(/toast-ok/);
  // Once answered, the country gets its real accessible name.
  await expect(target).toHaveAttribute('aria-label', c.en);
  await waitNext(page, 0);
  // Escape-able results dialog: the quit button returns home.
  await page.locator('.btn-quit').click();
  await expect(page.locator('.home')).toBeVisible();
});

test('the Arabic font is self-hosted and actually loaded', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.hostname !== 'localhost') external.push(r.url());
  });
  await openApp(page, 'ar');
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(async () => {
    await document.fonts.load('700 20px Tajawal', 'العربية');
    return [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Tajawal' && f.status === 'loaded').map((f) => f.weight);
  });
  expect(loaded.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.check('700 20px Tajawal', 'العربية'))).toBe(true);
  const family = await page.locator('.hero h1').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.startsWith('Tajawal')).toBe(true);
  const spacing = await page.locator('.hero h1').evaluate((el) => getComputedStyle(el).letterSpacing);
  expect(spacing).toBe('normal');
  // Start a game so the lazy map chunk loads too: still nothing from the internet.
  await setupAndStart(page, 'ar', { mode: 'find', region: 'world' });
  expect(external).toEqual([]);
});

test('accessibility basics: labelled controls, live regions and ✓/✗ marks that do not rely on colour', async ({ page }) => {
  await openApp(page, 'ar');
  for (const btn of await page.locator('button').all()) {
    const name = (await btn.getAttribute('aria-label')) ?? (await btn.innerText()).trim();
    expect(name.length).toBeGreaterThan(0);
  }
  const s: Setup = { mode: 'choice', region: 'gulf', count: 'all' };
  await setupAndStart(page, 'ar', s);
  await expect(page.locator('.toast')).toHaveAttribute('role', 'status');
  await expect(page.locator('svg.map')).toHaveAttribute('aria-label', DICT.ar.game.mapLabel);
  for (const b of await page.locator('.map-btn').all()) expect(await b.getAttribute('aria-label')).toBeTruthy();
  const c = await currentCountry(page, 'ar', s);
  await page.locator(`.choice:not([data-id="${c.id}"])`).first().click();
  await expect(page.locator('.choice.is-wrong .choice-mark')).toHaveText('✗');
  await page.locator(`.choice[data-id="${c.id}"]`).click();
  await expect(page.locator('.choice.is-correct .choice-mark')).toHaveText('✓');
  await expect(page.locator('.marker-ok text')).toHaveText('✓');
});

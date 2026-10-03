/**
 * Visual review matrix: {desktop, mobile} × {ar, en} × {light, dark} × {home, find, choice, type, results}.
 * Images go to $SHOTS_DIR (default: test-results/screenshots). These tests also check that
 * nothing overflows horizontally and that no text is clipped inside buttons/labels.
 */
import type { Page } from '@playwright/test';
import { answer, currentCountry, expect, openApp, setupAndStart, test, waitNext, type Lang, type Setup } from './helpers';

const OUT = process.env.SHOTS_DIR ?? 'test-results/screenshots';
const VIEWPORTS = { desktop: { width: 1366, height: 860 }, mobile: { width: 390, height: 844 } };

/** Elements whose text is cut (ellipsis-free overflow) — should be empty. */
async function clippedTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = 'button, label, .stat, .prompt, .toast, .choice, .mistake, .result-stat, legend, h1, h2, h3, .progress-text, .region-chip, .hint-text';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      if (el.closest('dialog:not([open])')) continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) {
        const style = getComputedStyle(el);
        if (style.overflow === 'visible' && el.scrollHeight > el.clientHeight + 2 && style.blockSize === 'auto') continue;
        out.push(`${el.className}: "${el.innerText.slice(0, 40)}" (${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight})`);
      }
    }
    return out;
  });
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(450); // let transitions settle
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(await clippedTexts(page), name).toEqual([]);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  for (const lang of ['ar', 'en'] as Lang[]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`screenshots ${device} ${lang} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openApp(page, lang, { theme });
        const tag = `${device}-${lang}-${theme}`;
        await shot(page, `${tag}-1-home`);

        // Find mode, after one correct and one wrong pick.
        const find: Setup = { mode: 'find', region: 'europe' };
        await setupAndStart(page, lang, find);
        let c = await currentCountry(page, lang, find);
        await answer(page, lang, find, c, true);
        await waitNext(page, 0);
        c = await currentCountry(page, lang, find);
        await answer(page, lang, find, c, false);
        await shot(page, `${tag}-2-find`);
        await page.locator('.btn-quit').click();

        // Multiple choice with a 50/50 hint.
        const choice: Setup = { mode: 'choice', region: 'arab' };
        await setupAndStart(page, lang, choice);
        await page.locator('.btn-hint').click();
        await shot(page, `${tag}-3-choice`);
        await page.locator('.btn-quit').click();

        // Typing capitals with a letter hint.
        const type: Setup = { mode: 'capitals', region: 'africa', capDirection: 'toCapital', capInput: 'type' };
        await setupAndStart(page, lang, type);
        await page.locator('.btn-hint').click();
        await page.locator('.answer-input').fill(lang === 'ar' ? 'القا' : 'Cai');
        await shot(page, `${tag}-4-type`);
        await page.locator('.btn-quit').click();

        // Results after a short round with mistakes.
        const gulf: Setup = { mode: 'find', region: 'gulf', count: 'all' };
        await setupAndStart(page, lang, gulf);
        for (let i = 0; i < 6; i++) {
          const q = await currentCountry(page, lang, gulf);
          if (i % 3 === 1) await page.locator('.btn-skip').click();
          else await answer(page, lang, gulf, q, true);
          await waitNext(page, i);
        }
        await expect(page.locator('dialog.results')).toBeVisible();
        await shot(page, `${tag}-5-results`);
      });
    }
  }
}

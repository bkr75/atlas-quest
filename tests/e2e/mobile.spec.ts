import type { Page } from '@playwright/test';
import { DICT, currentCountry, expect, openApp, setupAndStart, test, waitNext, type Setup } from './helpers';

/** Screen coordinates of a point that is inside the country's shape (and not covered by anything else). */
async function pointInside(page: Page, id: string): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate((cid) => {
    const helper = document.querySelector<SVGCircleElement>(`circle.helper[data-id="${cid}"]`);
    if (helper && helper.style.display !== 'none') {
      const r = helper.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    const path = document.querySelector<SVGPathElement>(`path.country[data-id="${cid}"]`)!;
    const box = path.getBBox();
    const ctm = path.getScreenCTM()!;
    const svg = path.ownerSVGElement!;
    for (let i = 1; i < 12; i++) {
      for (let j = 1; j < 12; j++) {
        const p = svg.createSVGPoint();
        p.x = box.x + (box.width * i) / 12;
        p.y = box.y + (box.height * j) / 12;
        if (!path.isPointInFill(p)) continue;
        const s = p.matrixTransform(ctm);
        const hit = document.elementFromPoint(s.x, s.y);
        if (hit === path) return { x: s.x, y: s.y };
      }
    }
    return null;
  }, id);
  if (!pt) throw new Error(`No tappable point for ${id}`);
  return pt;
}

test('touch: play a round of "find the country" by tapping the map', async ({ page }) => {
  await openApp(page, 'ar');
  const s: Setup = { mode: 'find', region: 'gulf', count: 'all' };
  await setupAndStart(page, 'ar', s);
  for (let i = 0; i < 6; i++) {
    const c = await currentCountry(page, 'ar', s);
    const { x, y } = await pointInside(page, c.id);
    await page.touchscreen.tap(x, y);
    await expect(page.locator(`path.country[data-id="${c.id}"]`)).toHaveClass(/is-correct/);
    await waitNext(page, i);
  }
  const dialog = page.locator('dialog.results');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.no-mistakes')).toHaveText(DICT.ar.results.noMistakes);
  // The results card fits the phone screen.
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.width).toBeLessThanOrEqual(vp.width);
});

test('touch: pinch to zoom and drag to pan the map', async ({ page }) => {
  await openApp(page, 'en');
  await setupAndStart(page, 'en', { mode: 'find', region: 'world' });
  const map = page.locator('svg.map');
  const box = (await map.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const scaleOf = async () => Number(await map.evaluate((el) => getComputedStyle(el).getPropertyValue('--k') || '1'));
  const before = await scaleOf();

  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, points: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ ...p, id: i })) } as never);
  await touch('touchStart', [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }]);
  for (let step = 1; step <= 10; step++) {
    await touch('touchMove', [{ x: cx - 20 - step * 8, y: cy }, { x: cx + 20 + step * 8, y: cy }]);
  }
  await touch('touchEnd', []);
  await expect.poll(scaleOf).toBeGreaterThan(before * 1.5);

  const transformBefore = await page.locator('g.viewport').getAttribute('transform');
  await touch('touchStart', [{ x: cx, y: cy }]);
  for (let step = 1; step <= 8; step++) await touch('touchMove', [{ x: cx + step * 10, y: cy + step * 5 }]);
  await touch('touchEnd', []);
  await expect(page.locator('g.viewport')).not.toHaveAttribute('transform', transformBefore ?? '');

  // Reset button restores the region view.
  await page.getByRole('button', { name: DICT.en.game.zoomReset }).tap();
  await expect.poll(scaleOf).toBeLessThan(before * 1.2);
});

test('touch: multiple choice with tapping on a phone, no horizontal overflow', async ({ page }) => {
  await openApp(page, 'ar');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  const s: Setup = { mode: 'choice', region: 'arab' };
  await setupAndStart(page, 'ar', s);
  expect(await overflow()).toBeLessThanOrEqual(0);
  for (let i = 0; i < 3; i++) {
    const c = await currentCountry(page, 'ar', s);
    await page.locator(`.choice[data-id="${c.id}"]`).tap();
    await expect(page.locator(`.choice[data-id="${c.id}"]`)).toHaveClass(/is-correct/);
    await waitNext(page, i);
  }
  expect(await overflow()).toBeLessThanOrEqual(0);
});

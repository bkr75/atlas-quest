import { COUNTRIES, type Country } from '../../src/data/countries';
import { DICT, answer, currentCountry, expect, openApp, questionIndex, setupAndStart, test, totalQuestions, waitNext, type Lang, type Setup } from './helpers';

const SETUPS: (Setup & { title: string })[] = [
  { title: 'find the country', mode: 'find', region: 'arab' },
  { title: 'type the name', mode: 'type', region: 'europe' },
  { title: 'multiple choice', mode: 'choice', region: 'africa' },
  { title: 'capitals: country → capital (choice)', mode: 'capitals', region: 'arab', capDirection: 'toCapital', capInput: 'choice' },
  { title: 'capitals: capital → country (typing)', mode: 'capitals', region: 'asia', capDirection: 'toCountry', capInput: 'type' },
];

const nameOf = (lang: Lang, c: Country) => (lang === 'ar' ? c.ar : c.en);

for (const lang of ['ar', 'en'] as const) {
  const d = DICT[lang];
  for (const s of SETUPS) {
    test(`[${lang}] full round — ${s.title}`, async ({ page }) => {
      await openApp(page, lang);
      await setupAndStart(page, lang, s);
      expect(await totalQuestions(page)).toBe(10);

      const late: Country[] = [];
      const missed: Country[] = [];
      for (let i = 0; i < 10; i++) {
        expect(await questionIndex(page)).toBe(i);
        const c = await currentCountry(page, lang, s);

        if (i === 1) {
          // Wrong first, then right (easy mode allows 3 attempts).
          await answer(page, lang, s, c, false);
          await expect(page.locator('.toast.toast-bad')).toContainText(lang === 'ar' ? 'بقيت' : 'left');
          if (s.mode === 'find') await expect(page.locator('.toast')).toContainText(lang === 'ar' ? 'هذه' : "That's");
          await answer(page, lang, s, c, true);
          late.push(c);
        } else if (i === 2) {
          // Use a hint, then answer.
          await page.locator('.btn-hint').click();
          if (s.mode === 'find') await expect(page.locator('.hint-area')).toHaveCount(1);
          else await expect(page.locator('.hint-text')).toBeVisible();
          if (s.mode === 'choice' || (s.mode === 'capitals' && s.capInput === 'choice')) {
            await expect(page.locator('.choice.is-wrong')).toHaveCount(2);
          }
          await answer(page, lang, s, c, true);
        } else if (i === 3) {
          // Give up: the right answer is revealed.
          await page.locator('.btn-skip').click();
          await expect(page.locator('.toast')).toHaveClass(/toast-bad/);
          const revealed = s.mode === 'capitals' && s.capDirection === 'toCapital' ? (lang === 'ar' ? c.capAr : c.capEn) : nameOf(lang, c);
          await expect(page.locator('.toast')).toContainText(revealed);
          missed.push(c);
        } else {
          await answer(page, lang, s, c, true);
          // Every outcome is verified on the results screen; check the live feedback on the first one.
          if (i === 0) await expect(page.locator('.toast.toast-ok')).toContainText(d.game.correct);
        }
        if (i === 0) await expect(page.locator('.stat-score .stat-value')).not.toHaveText(lang === 'ar' ? '٠' : '0');
        await waitNext(page, i);
      }

      // Results screen.
      const dialog = page.locator('dialog.results');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('h2')).toHaveText(d.results.title);
      await expect(dialog.locator('.record-badge')).toContainText(d.results.newRecord);
      await expect(dialog.locator('.mistake')).toHaveCount(2);
      for (const c of [...late, ...missed]) await expect(dialog.locator('.mistake-list')).toContainText(nameOf(lang, c));
      await expect(dialog.locator('.mistake.is-missed')).toContainText(nameOf(lang, missed[0]));
      await expect(dialog.locator('.mistake.is-late')).toContainText(nameOf(lang, late[0]));

      // Retry only the mistakes.
      await dialog.getByRole('button', { name: d.results.retryMistakes }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('.game')).toHaveAttribute('data-state', 'playing');
      expect(await totalQuestions(page)).toBe(2);
      const retried: string[] = [];
      for (let i = 0; i < 2; i++) {
        const c = await currentCountry(page, lang, s);
        retried.push(c.id);
        await answer(page, lang, s, c, true);
        await waitNext(page, i);
      }
      expect(retried.sort()).toEqual([late[0].id, missed[0].id].sort());
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.no-mistakes')).toHaveText(d.results.noMistakes);
      await expect(dialog.getByRole('button', { name: d.results.retryMistakes })).toHaveCount(0);

      // Back to the menu: the best score of the first round is saved and survives a reload.
      await dialog.getByRole('button', { name: d.results.menu }).click();
      await expect(page.locator('.home')).toBeVisible();
      await setupAndStartBack(page, s);
      await expect(page.locator('#best-score')).toHaveClass(/has-best/);
      const bestText = await page.locator('#best-score').innerText();
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('#best-score')).toHaveClass(/has-best/);
      await expect(page.locator('#best-score')).toHaveText(bestText);
    });
  }
}

/** The home screen remembers the last setup; nothing to re-select. */
async function setupAndStartBack(page: import('@playwright/test').Page, s: Setup) {
  await expect(page.locator(`input[name="mode"][value="${s.mode}"]`)).toBeChecked();
}

test('wrong pick on the map names the clicked country and keeps it secret until then', async ({ page }) => {
  await openApp(page, 'ar');
  const s: Setup = { mode: 'find', region: 'gulf', count: 'all' };
  await setupAndStart(page, 'ar', s);
  const c = await currentCountry(page, 'ar', s);
  const wrong = COUNTRIES.find((x) => x.regions.includes('gulf') && x.id !== c.id)!;
  await page.locator(`path.country[data-id="${wrong.id}"]`).dispatchEvent('click');
  await expect(page.locator('.toast')).toContainText(`هذه ${wrong.ar}`);
  await expect(page.locator(`path.country[data-id="${wrong.id}"]`)).toHaveClass(/is-flash-wrong/);
});

test('hard mode: one attempt, no hints, countdown expires', async ({ page }) => {
  await openApp(page, 'ar');
  const s: Setup = { mode: 'choice', region: 'gulf', difficulty: 'hard', count: 'all' };
  await setupAndStart(page, 'ar', s);
  await expect(page.locator('.btn-hint')).toHaveCount(0);
  await expect(page.locator('.countdown')).toBeVisible();
  await expect(page.locator('.stat-time .stat-label')).toHaveText(DICT.ar.game.timeLeft);
  // One wrong answer ends the question immediately.
  const c = await currentCountry(page, 'ar', s);
  await answer(page, 'ar', s, c, false);
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'answered');
  await expect(page.locator(`.choice[data-id="${c.id}"]`)).toHaveClass(/is-correct/);
  await waitNext(page, 0);
  // Let the clock run out.
  await expect(page.locator('.toast')).toContainText(DICT.ar.game.timeUp, { timeout: 15_000 });
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'answered');
});

test('typed Arabic answers are normalised (hamza, taa marbuta, tashkeel, spaces)', async ({ page }) => {
  await openApp(page, 'ar');
  const s: Setup = { mode: 'type', region: 'gulf', difficulty: 'medium', count: 'all' };
  await setupAndStart(page, 'ar', s);
  const variants: Record<string, string> = {
    SA: '  السعوديه ',
    AE: 'الامارات',
    BH: 'البَحرين',
    KW: 'الكويت',
    QA: 'قطر',
    OM: 'سلطنة عمان',
  };
  for (let i = 0; i < 6; i++) {
    const c = await currentCountry(page, 'ar', s);
    await page.locator('.answer-input').fill(variants[c.id]);
    await page.locator('.answer-input').press('Enter');
    await expect(page.locator('.toast')).toHaveClass(/toast-ok/);
    await waitNext(page, i);
  }
  await expect(page.locator('dialog.results .rs-accuracy .result-value')).toContainText('١٠٠٪');
});

import { expect, test as base, type Page } from '@playwright/test';
import { COUNTRIES, type Country } from '../../src/data/countries';
import ar from '../../src/i18n/ar.json' with { type: 'json' };
import en from '../../src/i18n/en.json' with { type: 'json' };

export type Lang = 'ar' | 'en';
export const DICT = { ar, en };

/** Fails the test on any console error/warning or uncaught exception. */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      await use(problems);
      expect(problems, 'console errors / warnings').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Open the app with a given language (only seeds settings if none are stored yet). */
export async function openApp(page: Page, lang: Lang, extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(
    ([l, more]) => {
      if (!localStorage.getItem('atlas-quest:settings')) {
        localStorage.setItem('atlas-quest:settings', JSON.stringify({ lang: l, theme: 'light', numerals: 'arab', muted: true, ...more }));
      }
    },
    [lang, extra] as const,
  );
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

/** Pick an option on the home screen by its visible label. */
export async function choose(page: Page, label: string): Promise<void> {
  await page.locator('label.option', { hasText: label }).first().click();
}

/** Select a home-screen radio by clicking its (visible) label, like a user would. */
export async function pick(page: Page, name: string, value: string): Promise<void> {
  await page.locator('label.option', { has: page.locator(`input[name="${name}"][value="${value}"]`) }).click();
  await expect(page.locator(`input[name="${name}"][value="${value}"]`)).toBeChecked();
}

export interface Setup {
  mode: 'find' | 'type' | 'choice' | 'capitals';
  region: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: '10' | '20' | 'all';
  capDirection?: 'toCapital' | 'toCountry';
  capInput?: 'choice' | 'type';
}

export async function setupAndStart(page: Page, lang: Lang, s: Setup): Promise<void> {
  const d = DICT[lang];
  await pick(page, 'mode', s.mode);
  if (s.mode === 'capitals') {
    await pick(page, 'capDirection', s.capDirection ?? 'toCapital');
    await pick(page, 'capInput', s.capInput ?? 'choice');
  }
  await choose(page, (d.region as Record<string, string>)[s.region]);
  await pick(page, 'difficulty', s.difficulty ?? 'easy');
  const countValue = s.count === 'all' ? '0' : s.count ?? '10';
  await pick(page, 'count', countValue);
  await page.getByRole('button', { name: d.home.start }).click();
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'playing');
}

const byName = (lang: Lang, name: string) => COUNTRIES.find((c) => (lang === 'ar' ? c.ar : c.en) === name);
const byCapital = (lang: Lang, name: string) => COUNTRIES.find((c) => (lang === 'ar' ? c.capAr : c.capEn) === name);

/** The country the current question is about. */
export async function currentCountry(page: Page, lang: Lang, s: Setup): Promise<Country> {
  const game = page.locator('.game');
  await expect(game).toHaveAttribute('data-state', 'playing');
  if (s.mode === 'find' || (s.mode === 'capitals' && s.capDirection === 'toCountry')) {
    const name = (await page.locator('.prompt-name').innerText()).trim();
    const c = s.mode === 'find' ? byName(lang, name) : byCapital(lang, name);
    if (!c) throw new Error(`No country for prompt "${name}"`);
    return c;
  }
  const id = await page.locator('path.country.is-target').getAttribute('data-id');
  const c = COUNTRIES.find((x) => x.id === id);
  if (!c) throw new Error(`No highlighted target (${id})`);
  return c;
}

export function inputKind(s: Setup): 'map' | 'text' | 'choice' {
  if (s.mode === 'find') return 'map';
  if (s.mode === 'type') return 'text';
  if (s.mode === 'choice') return 'choice';
  return s.capInput === 'type' ? 'text' : 'choice';
}

/** Answer correctly (true) or wrongly (false) using the right input method. */
export async function answer(page: Page, lang: Lang, s: Setup, c: Country, correct: boolean): Promise<void> {
  const kind = inputKind(s);
  if (kind === 'map') {
    let id = c.id;
    if (!correct) {
      id = (await page.locator('path.country.playable').evaluateAll((els, target) => els.map((e) => e.getAttribute('data-id')).find((x) => x !== target && !document.querySelector(`path[data-id="${x}"][class*="is-"]`)), c.id)) as string;
    }
    await page.locator(`path.country[data-id="${id}"]`).dispatchEvent('click');
  } else if (kind === 'choice') {
    const option = correct
      ? page.locator(`.choice[data-id="${c.id}"]`)
      : page.locator(`.choice:not([disabled]):not([data-id="${c.id}"])`).first();
    await option.click();
  } else {
    const capital = s.mode === 'capitals' && s.capDirection !== 'toCountry';
    const text = correct ? (capital ? (lang === 'ar' ? c.capAr : c.capEn) : lang === 'ar' ? c.ar : c.en) : lang === 'ar' ? 'خطأ تماما' : 'zzzz';
    await page.locator('.answer-input').fill(text);
    await page.locator('.answer-input').press('Enter');
  }
}

/** Wait until the question index moves past `index` (or the game ends). */
export async function waitNext(page: Page, index: number): Promise<void> {
  await expect
    .poll(async () => {
      const game = page.locator('.game');
      const state = await game.getAttribute('data-state');
      const q = Number(await game.getAttribute('data-q'));
      return state === 'over' || (state === 'playing' && q > index);
    }, { timeout: 8000 })
    .toBe(true);
}

export async function questionIndex(page: Page): Promise<number> {
  return Number(await page.locator('.game').getAttribute('data-q'));
}

export async function totalQuestions(page: Page): Promise<number> {
  return Number(await page.locator('.progress-track').getAttribute('aria-valuemax'));
}

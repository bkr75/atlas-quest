import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ar from '../../src/i18n/ar.json';
import en from '../../src/i18n/en.json';
import { fmt, fmtClock, fmtPercent, setLocale, t } from '../../src/i18n';

type Dict = { [k: string]: string | Dict };

function flatten(d: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translation files', () => {
  const flatAr = flatten(ar);
  const flatEn = flatten(en);

  it('have exactly the same keys', () => {
    expect(Object.keys(flatAr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('use the same placeholders in both languages (except plural forms)', () => {
    for (const key of Object.keys(flatEn)) {
      if (/\.(zero|one|two|few|many|other)$/.test(key)) continue;
      expect(placeholders(flatAr[key]), key).toEqual(placeholders(flatEn[key]));
    }
  });

  it('have no empty strings except unused plural slots', () => {
    for (const [key, value] of Object.entries({ ...flatAr, ...flatEn })) {
      if (key.startsWith('game.streakToast.')) continue;
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('Arabic UI strings are actually Arabic', () => {
    const arabic = /[؀-ۿ]/;
    const exceptions = ['header.switchLanguage', 'game.points'];
    for (const [key, value] of Object.entries(flatAr)) {
      if (exceptions.includes(key) || key.startsWith('game.streakToast.')) continue;
      expect(arabic.test(value), `${key} = ${value}`).toBe(true);
    }
  });
});

describe('t() and number formatting', () => {
  it('interpolates and picks Arabic plural forms', () => {
    setLocale('ar', 'arab');
    expect(t('home.countries', { count: 1 })).toBe('دولة واحدة');
    expect(t('home.countries', { count: 2 })).toBe('دولتان');
    expect(t('home.countries', { count: 5 })).toBe('٥ دول');
    expect(t('home.countries', { count: 22 })).toBe('٢٢ دولة');
    expect(t('home.countries', { count: 196 })).toBe('١٩٦ دولة');
    expect(t('game.prompt.find', { name: 'مصر' })).toBe('أين تقع مصر؟');
  });

  it('formats numbers with Arabic-Indic or Western digits on demand', () => {
    setLocale('ar', 'arab');
    expect(fmt(1234)).toBe('١٬٢٣٤');
    expect(fmtClock(65_000)).toBe('٠١:٠٥');
    expect(fmtPercent(80)).toMatch(/٨٠/);
    setLocale('ar', 'latn');
    expect(fmt(1234)).toBe('1,234');
    expect(fmtClock(65_000)).toBe('01:05');
    setLocale('en', 'arab');
    expect(fmt(1234)).toBe('1,234');
    expect(fmtPercent(80)).toBe('80%');
    expect(t('home.countries', { count: 1 })).toBe('1 country');
    expect(t('home.countries', { count: 54 })).toBe('54 countries');
  });
});

describe('source hygiene', () => {
  const srcDir = new URL('../../src/', import.meta.url).pathname;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(srcDir);

  it('has no hard-coded Arabic UI text outside the translation files and the country table', () => {
    // countries.ts is the bilingual data table; normalize.ts holds Arabic letter-normalisation rules (logic, not UI).
    const exempt = ['countries.ts', 'normalize.ts'];
    for (const file of files.filter((f) => /\.(ts|html)$/.test(f) && !exempt.some((e) => f.endsWith(e)))) {
      const code = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
        .join('\n');
      // The numerals toggle shows its own sample digits; the "ال" article is logic, not UI text.
      const cleaned = code.replace(/'١٢٣'/g, '').replace(/'ال'/g, '');
      expect(/[؀-ۿ]/.test(cleaned), file).toBe(false);
    }
  });

  it('never uses letter-spacing (it breaks Arabic letter joining)', () => {
    for (const file of files.filter((f) => f.endsWith('.css'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/letter-spacing/);
    }
  });

  it('uses logical properties instead of physical left/right in CSS', () => {
    for (const file of files.filter((f) => f.endsWith('.css'))) {
      const css = readFileSync(file, 'utf8');
      expect(css, file).not.toMatch(/(margin|padding|border)-(left|right)\s*:/);
      expect(css, file).not.toMatch(/(^|[\s;{])(left|right)\s*:/m);
      expect(css, file).not.toMatch(/text-align:\s*(left|right)/);
    }
  });
});

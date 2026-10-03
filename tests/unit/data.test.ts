import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTRIES, type Country } from '../../src/data/countries';
import { REGIONS, countriesInRegion } from '../../src/data/regions';
import { answerKey, looseArabicKey } from '../../src/lib/normalize';
import { capitalNames, countryNames } from '../../src/lib/match';

const ARABIC_ONLY = /^[ء-يًٰ-ْ ()]+$/;
const LATIN_ONLY = /^[A-Za-z\u00C0-\u024F'’.,\- ()]+$/;

describe('country data completeness', () => {
  it('has 196 playable countries', () => {
    expect(COUNTRIES).toHaveLength(196);
  });

  it('has unique ids and ISO numeric codes', () => {
    const ids = COUNTRIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nums = COUNTRIES.map((c) => c.num).filter(Boolean);
    expect(new Set(nums).size).toBe(nums.length);
    for (const c of COUNTRIES) expect(c.id).toMatch(/^[A-Z]{2}$/);
  });

  it.each(COUNTRIES.map((c) => [c.id, c] as [string, Country]))('%s has complete, clean names in both languages', (_id, c) => {
    for (const value of [c.en, c.ar, c.capEn, c.capAr, ...c.altEn, ...c.altAr, ...c.capAltEn, ...c.capAltAr]) {
      expect(value.trim()).toBe(value);
      expect(value.length).toBeGreaterThan(1);
      expect(value).not.toMatch(/\s{2,}/);
    }
    for (const value of [c.ar, c.capAr, ...c.altAr, ...c.capAltAr]) expect(value, `Arabic field "${value}"`).toMatch(ARABIC_ONLY);
    for (const value of [c.en, c.capEn, ...c.altEn, ...c.capAltEn]) expect(value, `English field "${value}"`).toMatch(LATIN_ONLY);
    expect(c.regions.length).toBeGreaterThan(0);
    expect(c.regions.some((r) => ['africa', 'asia', 'europe', 'namerica', 'samerica', 'oceania'].includes(r))).toBe(true);
  });

  it('has unique display names and capitals', () => {
    for (const field of ['en', 'ar'] as const) {
      const names = COUNTRIES.map((c) => c[field]);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('never accepts the same typed name for two different countries', () => {
    const owners = new Map<string, string>();
    for (const c of COUNTRIES) {
      for (const name of countryNames(c)) {
        for (const key of [answerKey(name), `loose:${looseArabicKey(name)}`]) {
          const prev = owners.get(key);
          expect(prev === undefined || prev === c.id, `"${name}" collides between ${prev} and ${c.id}`).toBe(true);
          owners.set(key, c.id);
        }
      }
    }
  });

  it('never accepts the same typed capital for two different countries', () => {
    const owners = new Map<string, string>();
    for (const c of COUNTRIES) {
      for (const name of capitalNames(c)) {
        const key = answerKey(name);
        const prev = owners.get(key);
        expect(prev === undefined || prev === c.id, `capital "${name}" collides between ${prev} and ${c.id}`).toBe(true);
        owners.set(key, c.id);
      }
    }
  });

  it('has the expected region sizes', () => {
    expect(countriesInRegion('arab')).toHaveLength(22);
    expect(countriesInRegion('gulf').map((c) => c.id).sort()).toEqual(['AE', 'BH', 'KW', 'OM', 'QA', 'SA']);
    expect(countriesInRegion('africa')).toHaveLength(54);
    expect(countriesInRegion('samerica')).toHaveLength(12);
    for (const r of REGIONS) expect(countriesInRegion(r.id).length).toBeGreaterThan(0);
  });

  it('uses the agreed Arabic names for well-known countries', () => {
    const ar = Object.fromEntries(COUNTRIES.map((c) => [c.id, c.ar]));
    expect(ar.SA).toBe('المملكة العربية السعودية');
    expect(ar.AE).toBe('الإمارات العربية المتحدة');
    expect(ar.CD).toBe('جمهورية الكونغو الديمقراطية');
    expect(ar.CI).toBe('ساحل العاج');
    expect(ar.MY).toBe('ماليزيا');
    expect(ar.MM).toBe('ميانمار');
    expect(ar.US).toBe('الولايات المتحدة الأمريكية');
    expect(ar.GB).toBe('المملكة المتحدة');
  });
});

describe('map ↔ data consistency', () => {
  const topo = JSON.parse(readFileSync(new URL('../../src/data/world.topo.json', import.meta.url), 'utf8'));
  const geoms: { id: string; properties: { territory?: boolean; name?: string } }[] = topo.objects.countries.geometries;

  it('has a map shape for every country', () => {
    const ids = new Set(geoms.map((g) => g.id));
    for (const c of COUNTRIES) expect(ids.has(c.id), `${c.id} has no shape`).toBe(true);
  });

  it('has data for every non-territory shape, and every shape is accounted for', () => {
    const dataIds = new Set(COUNTRIES.map((c) => c.id));
    for (const g of geoms) {
      if (g.properties.territory) expect(g.id).toMatch(/^T-\d+$/);
      else expect(dataIds.has(g.id), `shape ${g.id} has no data`).toBe(true);
    }
    expect(geoms.filter((g) => !g.properties.territory)).toHaveLength(COUNTRIES.length);
  });
});

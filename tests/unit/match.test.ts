import { describe, expect, it } from 'vitest';
import { COUNTRIES, getCountry } from '../../src/data/countries';
import { capitalNames, countryNames, levenshtein, matchesAny } from '../../src/lib/match';

const names = (id: string) => countryNames(getCountry(id));
const caps = (id: string) => capitalNames(getCountry(id));
const rivalsOf = (id: string) => COUNTRIES.filter((c) => c.id !== id).flatMap(countryNames);

describe('country name matching — Arabic', () => {
  it.each([
    ['AE', 'الإمارات'],
    ['AE', 'الامارات العربية المتحدة'],
    ['AE', 'الإمارات العربيه المتحده'],
    ['SA', 'السعودية'],
    ['SA', 'المملكه العربيه السعوديه'],
    ['SA', 'سعودية'],
    ['US', 'أمريكا'],
    ['US', 'امريكا'],
    ['US', 'الولايات المتحدة الأمريكية'],
    ['US', 'الولايات المتحده'],
    ['GB', 'بريطانيا'],
    ['GB', 'المملكة المتحدة'],
    ['EG', 'مِصر'],
    ['OM', 'عمان'],
    ['DZ', 'جزائر'],
    ['ES', 'اسبانيا'],
    ['CD', 'الكونغو الديمقراطية'],
    ['CI', 'كوت ديفوار'],
    ['MM', 'بورما'],
    ['IS', 'ايسلندا'],
  ])('%s accepts "%s"', (id, input) => {
    expect(matchesAny(input, names(id))).toBe(true);
  });

  it('rejects wrong countries', () => {
    expect(matchesAny('مصر', names('SA'))).toBe(false);
    expect(matchesAny('الكونغو', names('CD'))).toBe(false);
    expect(matchesAny('النيجر', names('NG'))).toBe(false);
    expect(matchesAny('', names('SA'))).toBe(false);
    expect(matchesAny('   ', names('SA'))).toBe(false);
  });
});

describe('country name matching — English', () => {
  it.each([
    ['US', 'USA'],
    ['US', 'united states'],
    ['US', 'United States of America'],
    ['US', 'u.s.a.'],
    ['GB', 'UK'],
    ['GB', 'great britain'],
    ['CI', 'cote divoire'],
    ['CI', 'Ivory Coast'],
    ['CZ', 'czech republic'],
    ['ST', 'sao tome and principe'],
    ['LC', 'St Lucia'],
    ['GM', 'the gambia'],
    ['MK', 'macedonia'],
    ['SZ', 'Swaziland'],
    ['TR', 'Turkiye'],
  ])('%s accepts "%s"', (id, input) => {
    expect(matchesAny(input, names(id))).toBe(true);
  });

  it('accepts either language regardless of UI language', () => {
    expect(matchesAny('Saudi Arabia', names('SA'))).toBe(true);
    expect(matchesAny('السعودية', names('SA'))).toBe(true);
  });
});

describe('capital matching', () => {
  it.each([
    ['SA', 'الرياض'],
    ['SA', 'riyadh'],
    ['AE', 'ابو ظبي'],
    ['AE', 'أبوظبي'],
    ['US', 'Washington DC'],
    ['US', 'واشنطن'],
    ['MY', 'كوالا لمبور'],
    ['JO', 'عمان'],
    ['DZ', 'الجزائر'],
    ['UA', 'Kiev'],
    ['MD', 'chisinau'],
  ])('%s accepts "%s"', (id, input) => {
    expect(matchesAny(input, caps(id))).toBe(true);
  });
});

describe('fuzzy matching (easy mode)', () => {
  it('accepts one typo in longer names', () => {
    expect(matchesAny('Argentna', names('AR'), { fuzzy: true })).toBe(true);
    expect(matchesAny('الارجنتن', names('AR'), { fuzzy: true })).toBe(true);
  });

  it('does not accept a typo when fuzzy is off', () => {
    expect(matchesAny('Argentna', names('AR'))).toBe(false);
  });

  it('never accepts another real country name as a typo', () => {
    expect(levenshtein('zambia', 'gambia')).toBe(1);
    expect(matchesAny('Zambia', names('GM'), { fuzzy: true, rivals: rivalsOf('GM') })).toBe(false);
    expect(matchesAny('Gambia', names('GM'), { fuzzy: true, rivals: rivalsOf('GM') })).toBe(true);
  });
});

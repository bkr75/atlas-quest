import { describe, expect, it } from 'vitest';
import { answerKey, looseArabicKey, normalizeArabic, normalizeLatin } from '../../src/lib/normalize';

describe('normalizeArabic', () => {
  it('unifies alef forms (أ إ آ ٱ → ا)', () => {
    expect(normalizeArabic('أإآٱا')).toBe('ااااا');
    expect(normalizeArabic('إسبانيا')).toBe(normalizeArabic('اسبانيا'));
    expect(normalizeArabic('آيسلندا')).toBe(normalizeArabic('ايسلندا'));
  });

  it('unifies taa marbuta and haa (ة → ه)', () => {
    expect(normalizeArabic('القاهرة')).toBe('القاهره');
    expect(normalizeArabic('سورية')).toBe(normalizeArabic('سوريه'));
  });

  it('unifies alef maqsura and yaa (ى → ي)', () => {
    expect(normalizeArabic('أبوظبى')).toBe(normalizeArabic('ابوظبي'));
    expect(normalizeArabic('موسى')).toBe('موسي');
  });

  it('strips tashkeel and tatweel', () => {
    expect(normalizeArabic('عُمَان')).toBe('عمان');
    expect(normalizeArabic('عمّان')).toBe('عمان');
    expect(normalizeArabic('مِصْرُ')).toBe('مصر');
    expect(normalizeArabic('الكـــويت')).toBe('الكويت');
    expect(normalizeArabic('تَنْزانِيا')).toBe('تنزانيا');
  });

  it('collapses and trims whitespace', () => {
    expect(normalizeArabic('   المملكة    العربية  السعودية ')).toBe('المملكه العربيه السعوديه');
    expect(normalizeArabic('\tالأردن\n')).toBe('الاردن');
  });

  it('unifies hamza seats and Persian letters', () => {
    expect(normalizeArabic('مؤتمر')).toBe('موتمر');
    expect(normalizeArabic('جزائر')).toBe('جزاير');
    expect(normalizeArabic('کندی')).toBe('كندي');
  });

  it('removes punctuation', () => {
    expect(normalizeArabic('غينيا-بيساو!')).toBe('غينيا بيساو');
  });
});

describe('normalizeLatin', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeLatin("CÔTE D'IVOIRE")).toBe('cote divoire');
    expect(normalizeLatin('São Tomé and Príncipe')).toBe('sao tome and principe');
    expect(normalizeLatin('  Bosnia   &  Herzegovina ')).toBe('bosnia and herzegovina');
  });

  it('expands St. and drops a leading "the"', () => {
    expect(normalizeLatin('St. Lucia')).toBe('saint lucia');
    expect(normalizeLatin('The Gambia')).toBe('gambia');
  });
});

describe('answer keys', () => {
  it('ignore spaces entirely', () => {
    expect(answerKey('كوالا لمبور')).toBe(answerKey('كوالالمبور'));
    expect(answerKey('New Zealand')).toBe(answerKey('newzealand'));
  });

  it('loose key ignores the Arabic definite article', () => {
    expect(looseArabicKey('السعودية')).toBe(looseArabicKey('سعودية'));
    expect(looseArabicKey('الجزائر')).toBe(looseArabicKey('جزائر'));
  });
});

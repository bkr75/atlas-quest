/**
 * Text normalisation used to compare typed answers with the expected names.
 */

// Arabic diacritics (tashkeel), Quranic marks and the superscript alef.
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const PUNCTUATION = /[\p{P}\p{S}]/gu;

/** Normalise Arabic text: strip tashkeel/tatweel, unify letter variants, collapse spaces. */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[‌‍‎‏]/g, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise Latin text: lower-case, strip accents and punctuation, common abbreviations. */
export function normalizeLatin(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`ʻ]/g, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/\bst\b/g, 'saint')
    .replace(/\bdem\b/g, 'democratic')
    .replace(/\brep\b/g, 'republic');
}

/** Normalise any answer text (Arabic and Latin rules are both safe to apply). */
export function normalizeAnswer(input: string): string {
  return normalizeLatin(normalizeArabic(input));
}

/** Comparison key: normalised text without any spaces (so "كوالا لمبور" == "كوالالمبور"). */
export function answerKey(input: string): string {
  return normalizeAnswer(input).replace(/ /g, '');
}

/** Same as answerKey but also ignores the Arabic definite article "ال" at the start of each word. */
export function looseArabicKey(input: string): string {
  return normalizeAnswer(input)
    .split(' ')
    .map((w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w))
    .join('');
}

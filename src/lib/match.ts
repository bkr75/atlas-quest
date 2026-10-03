import type { Country } from '../data/countries';
import { answerKey, looseArabicKey } from './normalize';

/** All accepted names for a country (both languages; players may answer in either). */
export function countryNames(c: Country): string[] {
  return [c.ar, ...c.altAr, c.en, ...c.altEn];
}

/** All accepted names for a capital city (both languages). */
export function capitalNames(c: Country): string[] {
  return [c.capAr, ...c.capAltAr, c.capEn, ...c.capAltEn];
}

/** Classic Levenshtein distance (small strings only). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export interface MatchOptions {
  /** Allow one typo for answers of 5+ characters (easy mode). */
  fuzzy?: boolean;
  /** Names of the *other* possible answers: an exact hit on one of them is never fuzzily accepted. */
  rivals?: string[];
}

/** True when the typed input matches one of the accepted names. */
export function matchesAny(input: string, accepted: string[], opts: MatchOptions = {}): boolean {
  const key = answerKey(input);
  if (!key) return false;
  const loose = looseArabicKey(input);
  for (const name of accepted) {
    if (answerKey(name) === key || looseArabicKey(name) === loose) return true;
  }
  if (!opts.fuzzy || key.length < 5) return false;
  if (opts.rivals?.some((r) => answerKey(r) === key || looseArabicKey(r) === loose)) return false;
  return accepted.some((name) => levenshtein(answerKey(name), key) <= 1);
}

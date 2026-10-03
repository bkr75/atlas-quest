import ar from './ar.json';
import en from './en.json';
import type { Country } from '../data/countries';

export type Lang = 'ar' | 'en';
export type Numerals = 'arab' | 'latn';
type Dict = { [key: string]: string | Dict };
type Params = Record<string, string | number>;

export const DICTIONARIES: Record<Lang, Dict> = { ar, en };

let lang: Lang = 'ar';
let numerals: Numerals = 'arab';
let numberFormat = makeNumberFormat();

function makeNumberFormat(opts: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = lang === 'ar' ? `ar-u-nu-${numerals}` : 'en-US';
  return new Intl.NumberFormat(locale, opts);
}

export function setLocale(next: Lang, nextNumerals: Numerals): void {
  lang = next;
  numerals = nextNumerals;
  numberFormat = makeNumberFormat();
}

export function getLang(): Lang {
  return lang;
}

export function getNumerals(): Numerals {
  return numerals;
}

export function dir(l: Lang = lang): 'rtl' | 'ltr' {
  return l === 'ar' ? 'rtl' : 'ltr';
}

function lookup(dict: Dict, key: string): string | Dict | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node;
}

/** Resolve a key (with plural selection when `params.count` is given and the entry is a plural object). */
function resolve(key: string, params?: Params): string {
  let node = lookup(DICTIONARIES[lang], key);
  if (node && typeof node === 'object' && params && typeof params.count === 'number') {
    const category = new Intl.PluralRules(lang).select(params.count);
    node = node[category] ?? node.other;
  }
  if (typeof node !== 'string') {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key "${key}" for ${lang}`);
    return key;
  }
  return node;
}

function formatParam(value: string | number): string {
  return typeof value === 'number' ? fmt(value) : value;
}

/** Translate a key into a plain string. Numbers in params are localised. */
export function t(key: string, params?: Params): string {
  const template = resolve(key, params);
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? formatParam(params[name]) : m));
}

/**
 * Translate into a DocumentFragment where every interpolated value is wrapped in <bdi>,
 * so names and numbers never break the direction of the surrounding sentence.
 */
export function tNode(key: string, params: Params = {}): DocumentFragment {
  const frag = document.createDocumentFragment();
  const template = resolve(key, params);
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    const index = m.index ?? 0;
    if (index > last) frag.append(template.slice(last, index));
    const bdi = document.createElement('bdi');
    bdi.textContent = m[1] in params ? formatParam(params[m[1]]) : m[0];
    frag.append(bdi);
    last = index + m[0].length;
  }
  if (last < template.length) frag.append(template.slice(last));
  return frag;
}

/** Localised number. */
export function fmt(n: number): string {
  return numberFormat.format(n);
}

/** Localised percentage from 0..100. */
export function fmtPercent(value: number): string {
  return makeNumberFormat({ style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}

/** Localised mm:ss clock. */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const two = makeNumberFormat({ minimumIntegerDigits: 2, useGrouping: false });
  return `${two.format(Math.floor(total / 60))}:${two.format(total % 60)}`;
}

export function countryName(c: Country, l: Lang = lang): string {
  return l === 'ar' ? c.ar : c.en;
}

export function capitalName(c: Country, l: Lang = lang): string {
  return l === 'ar' ? c.capAr : c.capEn;
}

/** Locale-aware collator for sorting names. */
export function collator(): Intl.Collator {
  return new Intl.Collator(lang);
}

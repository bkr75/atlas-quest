import type { Lang, Numerals } from '../i18n';
import type { GameConfig } from '../game/engine';

export type Theme = 'light' | 'dark';

export interface Settings {
  lang: Lang;
  theme: Theme;
  numerals: Numerals;
  muted: boolean;
  config: GameConfig;
}

export interface BestScore {
  score: number;
  accuracy: number;
  timeMs: number;
  date: string;
}

const SETTINGS_KEY = 'atlas-quest:settings';
const BEST_KEY = 'atlas-quest:best';

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'find',
  region: 'world',
  difficulty: 'easy',
  count: 10,
  capDirection: 'toCapital',
  capInput: 'choice',
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — the game still works */
  }
}

export function loadSettings(defaults: Omit<Settings, 'config'>): Settings {
  const saved = read<Partial<Settings>>(SETTINGS_KEY) ?? {};
  return {
    lang: saved.lang === 'en' || saved.lang === 'ar' ? saved.lang : defaults.lang,
    theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : defaults.theme,
    numerals: saved.numerals === 'latn' || saved.numerals === 'arab' ? saved.numerals : defaults.numerals,
    muted: typeof saved.muted === 'boolean' ? saved.muted : defaults.muted,
    config: { ...DEFAULT_CONFIG, ...(saved.config ?? {}) },
  };
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings);
}

export function loadBest(key: string): BestScore | null {
  return read<Record<string, BestScore>>(BEST_KEY)?.[key] ?? null;
}

/** Save a score if it beats the stored one. Returns true for a new record. */
export function submitBest(key: string, entry: BestScore): boolean {
  const all = read<Record<string, BestScore>>(BEST_KEY) ?? {};
  const prev = all[key];
  if (prev && prev.score >= entry.score) return false;
  all[key] = entry;
  write(BEST_KEY, all);
  return true;
}

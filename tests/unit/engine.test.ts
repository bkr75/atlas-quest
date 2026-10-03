import { describe, expect, it } from 'vitest';
import { getCountry } from '../../src/data/countries';
import { Game, hintPrefix, questionPool, recordKey, type GameConfig } from '../../src/game/engine';

/** Deterministic PRNG (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const base: GameConfig = { mode: 'find', region: 'world', difficulty: 'easy', count: 10, capDirection: 'toCapital', capInput: 'choice' };
const wrongId = (g: Game) => (g.current.id === 'FR' ? 'DE' : 'FR');

describe('Game setup', () => {
  it('draws the requested number of unique questions from the region', () => {
    const g = new Game({ ...base, region: 'europe', count: 20 }, seeded(1));
    expect(g.total).toBe(20);
    expect(new Set(g.questions.map((q) => q.id)).size).toBe(20);
    for (const q of g.questions) expect(getCountry(q.id).regions).toContain('europe');
  });

  it('uses every country when count is 0', () => {
    const g = new Game({ ...base, region: 'gulf', count: 0 }, seeded(2));
    expect(g.total).toBe(6);
  });

  it('builds 4 distinct options including the answer for choice questions', () => {
    const g = new Game({ ...base, mode: 'choice', region: 'africa' }, seeded(3));
    for (const q of g.questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.id);
    }
  });

  it('skips countries with a disputed capital in capitals mode', () => {
    const ids = questionPool({ mode: 'capitals', region: 'asia' }).map((c) => c.id);
    expect(ids).not.toContain('IL');
    expect(ids).not.toContain('PS');
    expect(questionPool({ mode: 'find', region: 'asia' }).map((c) => c.id)).toContain('PS');
  });

  it('maps modes to input kinds and answer fields', () => {
    expect(new Game(base, seeded(1)).inputKind).toBe('map');
    expect(new Game({ ...base, mode: 'type' }, seeded(1)).inputKind).toBe('text');
    expect(new Game({ ...base, mode: 'capitals', capInput: 'type' }, seeded(1)).inputKind).toBe('text');
    expect(new Game({ ...base, mode: 'capitals' }, seeded(1)).answerField).toBe('capital');
    expect(new Game({ ...base, mode: 'capitals', capDirection: 'toCountry' }, seeded(1)).answerField).toBe('country');
  });
});

describe('Game flow', () => {
  it('scores a correct first attempt, builds a streak and advances', () => {
    const g = new Game(base, seeded(4));
    const first = g.answerId(g.current.id);
    expect(first).toMatchObject({ correct: true, finished: true, points: 100 });
    expect(g.streak.current).toBe(1);
    g.next();
    const second = g.answerId(g.current.id);
    expect(second.points).toBe(110);
    expect(g.score).toBe(210);
  });

  it('allows 3 attempts on easy, then reveals', () => {
    const g = new Game(base, seeded(5));
    expect(g.answerId(wrongId(g))).toMatchObject({ correct: false, finished: false, attemptsLeft: 2 });
    expect(g.answerId(wrongId(g))).toMatchObject({ correct: false, finished: false, attemptsLeft: 1 });
    expect(g.answerId(wrongId(g))).toMatchObject({ correct: false, finished: true });
    expect(g.results[0]).toMatchObject({ correct: false, attempts: 3 });
    expect(g.mistakes()).toEqual([g.current.id]);
  });

  it('gives half points on a second attempt and resets the streak', () => {
    const g = new Game(base, seeded(6));
    g.answerId(g.current.id);
    g.next();
    g.answerId(wrongId(g));
    expect(g.streak.current).toBe(0);
    expect(g.answerId(g.current.id).points).toBe(50);
    expect(g.mistakes()).toEqual([g.current.id]);
  });

  it('allows only one attempt on hard and no hints', () => {
    const g = new Game({ ...base, difficulty: 'hard' }, seeded(7));
    expect(g.canHint).toBe(false);
    expect(g.useHint()).toBeNull();
    expect(g.answerId(wrongId(g)).finished).toBe(true);
  });

  it('adds the time bonus on hard', () => {
    const g = new Game({ ...base, difficulty: 'hard' }, seeded(8));
    expect(g.answerId(g.current.id, 10).points).toBe(150);
  });

  it('handles timeouts as a missed question', () => {
    const g = new Game({ ...base, difficulty: 'hard' }, seeded(9));
    expect(g.timeout()).toMatchObject({ correct: false, finished: true });
    expect(g.results[0].timedOut).toBe(true);
  });

  it('throws when answering a finished question or advancing early', () => {
    const g = new Game(base, seeded(10));
    expect(() => g.next()).toThrow();
    g.answerId(g.current.id);
    expect(() => g.answerId(g.current.id)).toThrow();
  });

  it('ends after the last question and computes accuracy', () => {
    const g = new Game({ ...base, count: 4 }, seeded(11));
    g.answerId(g.current.id);
    g.next();
    g.answerId(g.current.id);
    g.next();
    g.answerId(wrongId(g));
    g.answerId(g.current.id);
    g.next();
    g.skip();
    expect(g.next()).toBe(false);
    expect(g.isOver).toBe(true);
    expect(g.accuracy).toBe(50);
    expect(g.streak.best).toBe(2);
    expect(g.mistakes()).toHaveLength(2);
  });

  it('can be restarted with only the mistakes', () => {
    const g = new Game({ ...base, count: 5 }, seeded(12));
    const ids = g.questions.slice(0, 2).map((q) => q.id);
    const retry = new Game(base, seeded(13), ids);
    expect(retry.total).toBe(2);
    expect(retry.questions.map((q) => q.id).sort()).toEqual([...ids].sort());
  });
});

describe('typed answers', () => {
  it('accepts names in Arabic or English, with alternatives', () => {
    const g = new Game({ ...base, mode: 'type', difficulty: 'medium' }, seeded(14), ['SA']);
    expect(g.answerText('السعوديه').correct).toBe(true);
    const g2 = new Game({ ...base, mode: 'type', difficulty: 'medium' }, seeded(14), ['US']);
    expect(g2.answerText('usa').correct).toBe(true);
  });

  it('accepts one typo only in easy mode', () => {
    const easy = new Game({ ...base, mode: 'type', difficulty: 'easy' }, seeded(15), ['AR']);
    expect(easy.answerText('Argentna').correct).toBe(true);
    const medium = new Game({ ...base, mode: 'type', difficulty: 'medium' }, seeded(15), ['AR']);
    expect(medium.answerText('Argentna').correct).toBe(false);
  });

  it('checks capitals in capitals mode', () => {
    const g = new Game({ ...base, mode: 'capitals', capInput: 'type', difficulty: 'medium' }, seeded(16), ['JO']);
    expect(g.answerText('عمان').correct).toBe(true);
    const g2 = new Game({ ...base, mode: 'capitals', capInput: 'type', difficulty: 'medium' }, seeded(16), ['JO']);
    expect(g2.answerText('الأردن').correct).toBe(false);
  });
});

describe('hints', () => {
  it('limits hints to 3 per game on medium', () => {
    const g = new Game({ ...base, mode: 'type', difficulty: 'medium', count: 5 }, seeded(17));
    expect(g.useHint()).toEqual({ kind: 'letters', level: 1 });
    expect(g.useHint()).toEqual({ kind: 'letters', level: 2 });
    expect(g.canHint).toBe(false); // max 2 per question
    g.skip();
    g.next();
    expect(g.useHint()).not.toBeNull();
    expect(g.hintsLeft).toBe(0);
    expect(g.canHint).toBe(false);
  });

  it('removes two wrong options with a 50/50 hint', () => {
    const g = new Game({ ...base, mode: 'choice' }, seeded(18));
    const hint = g.useHint();
    expect(hint?.kind).toBe('fifty');
    if (hint?.kind !== 'fifty') return;
    expect(hint.removed).toHaveLength(2);
    expect(hint.removed).not.toContain(g.current.id);
    expect(g.canHint).toBe(false);
  });

  it('gives map area hints in find mode and reduces points', () => {
    const g = new Game(base, seeded(19));
    expect(g.useHint()).toEqual({ kind: 'area', level: 1 });
    expect(g.answerId(g.current.id).points).toBe(60);
  });

  it('builds letter prefixes that never reveal the whole answer', () => {
    expect(hintPrefix('فرنسا', 1)).toBe('ف');
    expect(hintPrefix('السعودية', 1)).toBe('الس');
    expect(hintPrefix('Argentina', 1)).toBe('A');
    expect(hintPrefix('Argentina', 2)).toBe('Argen');
    expect(hintPrefix('Mali', 2)).toBe('Ma');
    expect(hintPrefix('Chad', 2).length).toBeLessThan(4);
  });
});

describe('recordKey', () => {
  it('distinguishes every setting that changes the game', () => {
    const keys = new Set([
      recordKey(base),
      recordKey({ ...base, region: 'asia' }),
      recordKey({ ...base, difficulty: 'hard' }),
      recordKey({ ...base, count: 0 }),
      recordKey({ ...base, mode: 'capitals' }),
      recordKey({ ...base, mode: 'capitals', capDirection: 'toCountry' }),
    ]);
    expect(keys.size).toBe(6);
  });
});

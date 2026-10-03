export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyRules {
  /** Attempts allowed per question before the answer is revealed. */
  attempts: number;
  /** Hints allowed per game (Infinity = unlimited, 0 = none). */
  hints: number;
  /** Seconds per question (0 = no countdown, the clock only counts up). */
  secondsPerQuestion: number;
  /** Accept answers with one typo when typing. */
  fuzzy: boolean;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  easy: { attempts: 3, hints: Infinity, secondsPerQuestion: 0, fuzzy: true },
  medium: { attempts: 2, hints: 3, secondsPerQuestion: 0, fuzzy: false },
  hard: { attempts: 1, hints: 0, secondsPerQuestion: 12, fuzzy: false },
};

export const BASE_POINTS = 100;
export const STREAK_BONUS = 10;
export const MAX_STREAK_BONUS = 50;
export const HINT_PENALTY = 0.4;
export const TIME_BONUS_PER_SECOND = 5;

export interface PointsInput {
  /** 1-based attempt on which the answer was correct. */
  attempt: number;
  /** Hints used on this question. */
  hintsUsed: number;
  /** Streak *before* this answer. */
  streak: number;
  /** Seconds left on the countdown (hard mode), else 0. */
  secondsLeft?: number;
}

/**
 * Points for a correct answer.
 * - first attempt = 100, second = 50, third = 25
 * - each hint removes 40% of the base (never below 10)
 * - +10 per previous consecutive correct answer (max +50), only on a first-attempt answer
 * - hard mode: +5 per second left
 */
export function pointsFor({ attempt, hintsUsed, streak, secondsLeft = 0 }: PointsInput): number {
  let base = BASE_POINTS / 2 ** (attempt - 1);
  base *= Math.max(0, 1 - HINT_PENALTY * hintsUsed);
  base = Math.max(10, Math.round(base));
  const streakBonus = attempt === 1 ? Math.min(streak * STREAK_BONUS, MAX_STREAK_BONUS) : 0;
  const timeBonus = Math.max(0, Math.floor(secondsLeft)) * TIME_BONUS_PER_SECOND;
  return base + streakBonus + timeBonus;
}

/** Streak tracker: grows on first-attempt correct answers, resets on any mistake. */
export class Streak {
  current = 0;
  best = 0;
  hit(): void {
    this.current += 1;
    this.best = Math.max(this.best, this.current);
  }
  miss(): void {
    this.current = 0;
  }
}

/** Accuracy (0..100): share of questions answered correctly on the first try. */
export function accuracy(firstTry: number, total: number): number {
  return total === 0 ? 0 : Math.round((firstTry / total) * 100);
}

export type Clock = () => number;

/**
 * Game timer with pause support and an optional per-question countdown.
 * The clock is injectable so it can be unit-tested deterministically.
 */
export class GameTimer {
  private startedAt = 0;
  private accumulated = 0;
  private running = false;
  private questionStartedElapsed = 0;

  constructor(
    private readonly countdownSeconds: number,
    private readonly now: Clock = () => performance.now(),
  ) {}

  start(): void {
    if (this.running) return;
    this.startedAt = this.now();
    this.running = true;
  }

  pause(): void {
    if (!this.running) return;
    this.accumulated += this.now() - this.startedAt;
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Total elapsed milliseconds (excluding paused time). */
  elapsedMs(): number {
    return this.accumulated + (this.running ? this.now() - this.startedAt : 0);
  }

  /** Restart the per-question countdown. */
  startQuestion(): void {
    this.questionStartedElapsed = this.elapsedMs();
  }

  /** Seconds left for the current question, or null when there is no countdown. */
  secondsLeft(): number | null {
    if (!this.countdownSeconds) return null;
    const used = (this.elapsedMs() - this.questionStartedElapsed) / 1000;
    return Math.max(0, this.countdownSeconds - used);
  }

  isExpired(): boolean {
    const left = this.secondsLeft();
    return left !== null && left <= 0;
  }
}

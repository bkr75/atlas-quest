import { getCountry, type Country, type RegionId, type Tier } from '../data/countries';
import { countriesInRegion } from '../data/regions';
import { capitalNames, countryNames, matchesAny } from '../lib/match';
import { DIFFICULTY, Streak, accuracy, pointsFor, type Difficulty, type DifficultyRules } from '../lib/scoring';

export type Mode = 'find' | 'type' | 'choice' | 'capitals';
export type CapDirection = 'toCapital' | 'toCountry';
export type CapInput = 'choice' | 'type';

export interface GameConfig {
  mode: Mode;
  region: RegionId;
  difficulty: Difficulty;
  /** 1 = famous countries only, 2 = adds medium-known ones, 3 = every country. */
  level: Tier;
  /** Number of questions, 0 = every country of the region. */
  count: number;
  capDirection: CapDirection;
  capInput: CapInput;
}

export type InputKind = 'map' | 'text' | 'choice';
/** What the player must produce: a country (name or click) or a capital name. */
export type AnswerField = 'country' | 'capital';

export interface Question {
  id: string;
  /** Option country ids for choice questions (includes `id`). */
  options: string[];
}

export interface QuestionResult {
  id: string;
  correct: boolean;
  attempts: number;
  hintsUsed: number;
  timedOut: boolean;
  points: number;
}

export interface AnswerOutcome {
  correct: boolean;
  /** The question is over (answered correctly or out of attempts). */
  finished: boolean;
  points: number;
  attemptsLeft: number;
}

export type Hint =
  | { kind: 'area'; level: number }
  | { kind: 'letters'; level: number }
  | { kind: 'fifty'; removed: string[] };

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Countries that can be asked for a given config (capitals mode skips disputed capitals). */
export function questionPool(config: Pick<GameConfig, 'mode' | 'region'> & { level?: Tier }): Country[] {
  const list = countriesInRegion(config.region, config.level ?? 3);
  return config.mode === 'capitals' ? list.filter((c) => !c.capitalDisputed) : list;
}

/** Text revealed by a "letters" hint: level 1 = first letter (after "ال"), level 2 = half the name. */
export function hintPrefix(answer: string, level: number): string {
  const chars = [...answer];
  const article = answer.startsWith('ال') ? 2 : 0;
  const n = level <= 1 ? article + 1 : Math.max(article + 2, Math.ceil(chars.length / 2));
  return chars.slice(0, Math.min(n, chars.length - 1)).join('');
}

export class Game {
  readonly rules: DifficultyRules;
  readonly questions: Question[];
  readonly results: QuestionResult[] = [];
  index = 0;
  score = 0;
  readonly streak = new Streak();
  hintsUsedTotal = 0;

  private attempt = 0;
  private hintsThisQuestion = 0;
  private removedOptions = new Set<string>();
  private finishedCurrent = false;
  private readonly pool: Country[];

  constructor(
    readonly config: GameConfig,
    private readonly rng: Rng = Math.random,
    /** Explicit list of country ids (used by "retry mistakes"). */
    questionIds?: string[],
  ) {
    this.rules = DIFFICULTY[config.difficulty];
    this.pool = questionPool(config);
    let ids = questionIds ?? shuffle(this.pool.map((c) => c.id), rng);
    if (!questionIds && config.count > 0) ids = ids.slice(0, config.count);
    if (questionIds) ids = shuffle(ids, rng);
    this.questions = ids.map((id) => ({ id, options: this.inputKind === 'choice' ? this.makeOptions(id) : [] }));
  }

  get inputKind(): InputKind {
    const { mode, capInput } = this.config;
    if (mode === 'find') return 'map';
    if (mode === 'type') return 'text';
    if (mode === 'choice') return 'choice';
    return capInput === 'type' ? 'text' : 'choice';
  }

  get answerField(): AnswerField {
    return this.config.mode === 'capitals' && this.config.capDirection === 'toCapital' ? 'capital' : 'country';
  }

  /** True when the target country is highlighted on the map (everything except "find" and capital→country). */
  get highlightsTarget(): boolean {
    if (this.config.mode === 'find') return false;
    if (this.config.mode === 'capitals') return this.config.capDirection === 'toCapital';
    return true;
  }

  get total(): number {
    return this.questions.length;
  }

  get current(): Question {
    return this.questions[this.index];
  }

  get currentCountry(): Country {
    return getCountry(this.current.id);
  }

  get isOver(): boolean {
    return this.index >= this.questions.length;
  }

  get questionFinished(): boolean {
    return this.finishedCurrent;
  }

  get attemptsLeft(): number {
    return this.rules.attempts - this.attempt;
  }

  get hintsLeft(): number {
    return this.rules.hints - this.hintsUsedTotal;
  }

  get hintsOnQuestion(): number {
    return this.hintsThisQuestion;
  }

  /** Choice options still enabled (after 50/50 hints and wrong picks). */
  isOptionRemoved(id: string): boolean {
    return this.removedOptions.has(id);
  }

  get canHint(): boolean {
    if (this.finishedCurrent || this.hintsLeft <= 0) return false;
    if (this.inputKind === 'choice') return this.hintsThisQuestion === 0 && this.liveOptions().length > 2;
    return this.hintsThisQuestion < 2;
  }

  useHint(): Hint | null {
    if (!this.canHint) return null;
    this.hintsThisQuestion += 1;
    this.hintsUsedTotal += 1;
    if (this.inputKind === 'choice') {
      const wrong = shuffle(this.liveOptions().filter((id) => id !== this.current.id), this.rng);
      const removed = wrong.slice(0, Math.max(0, this.liveOptions().length - 2));
      removed.forEach((id) => this.removedOptions.add(id));
      return { kind: 'fifty', removed };
    }
    if (this.inputKind === 'map') return { kind: 'area', level: this.hintsThisQuestion };
    return { kind: 'letters', level: this.hintsThisQuestion };
  }

  /** Answer with a country id (map click or choice button). */
  answerId(id: string, secondsLeft = 0): AnswerOutcome {
    if (this.inputKind === 'choice') this.removedOptions.add(id);
    return this.resolve(id === this.current.id, secondsLeft);
  }

  /** Answer with typed text. */
  answerText(text: string, secondsLeft = 0): AnswerOutcome {
    const target = this.currentCountry;
    const field = this.answerField;
    const namesOf = field === 'capital' ? capitalNames : countryNames;
    const rivals = this.pool.filter((c) => c.id !== target.id).flatMap(namesOf);
    const ok = matchesAny(text, namesOf(target), { fuzzy: this.rules.fuzzy, rivals });
    return this.resolve(ok, secondsLeft);
  }

  /** The countdown expired: the question is lost. */
  timeout(): AnswerOutcome {
    if (this.finishedCurrent) return { correct: false, finished: true, points: 0, attemptsLeft: 0 };
    this.attempt = this.rules.attempts;
    return this.finish(false, 0, true);
  }

  /** Give up on the current question. */
  skip(): AnswerOutcome {
    return this.timeout();
  }

  /** Move to the next question. Returns false when the game is over. */
  next(): boolean {
    if (!this.finishedCurrent) throw new Error('Current question is not finished');
    this.index += 1;
    this.attempt = 0;
    this.hintsThisQuestion = 0;
    this.removedOptions = new Set();
    this.finishedCurrent = false;
    return !this.isOver;
  }

  mistakes(): string[] {
    return this.results.filter((r) => !r.correct || r.attempts > 1).map((r) => r.id);
  }

  get firstTryCount(): number {
    return this.results.filter((r) => r.correct && r.attempts === 1).length;
  }

  get accuracy(): number {
    return accuracy(this.firstTryCount, this.total);
  }

  private liveOptions(): string[] {
    return this.current.options.filter((id) => !this.removedOptions.has(id));
  }

  private resolve(correct: boolean, secondsLeft: number): AnswerOutcome {
    if (this.finishedCurrent || this.isOver) throw new Error('Question already finished');
    this.attempt += 1;
    if (correct) {
      const points = pointsFor({
        attempt: this.attempt,
        hintsUsed: this.hintsThisQuestion,
        streak: this.streak.current,
        secondsLeft,
      });
      return this.finish(true, points, false);
    }
    this.streak.miss();
    if (this.attempt >= this.rules.attempts || (this.inputKind === 'choice' && this.liveOptions().length <= 1)) {
      return this.finish(false, 0, false);
    }
    return { correct: false, finished: false, points: 0, attemptsLeft: this.attemptsLeft };
  }

  private finish(correct: boolean, points: number, timedOut: boolean): AnswerOutcome {
    if (correct && this.attempt === 1) this.streak.hit();
    else this.streak.miss();
    this.score += points;
    this.finishedCurrent = true;
    this.results.push({
      id: this.current.id,
      correct,
      attempts: this.attempt,
      hintsUsed: this.hintsThisQuestion,
      timedOut,
      points,
    });
    return { correct, finished: true, points, attemptsLeft: 0 };
  }

  private makeOptions(id: string): string[] {
    const target = getCountry(id);
    const others = this.pool.filter((c) => c.id !== id);
    // Prefer distractors from a shared continent so options are plausible.
    const near = others.filter((c) => c.regions.some((r) => target.regions.includes(r) && r !== 'arab' && r !== 'gulf'));
    const source = near.length >= 3 ? near : others;
    const distractors = shuffle(source, this.rng).slice(0, 3).map((c) => c.id);
    return shuffle([id, ...distractors], this.rng);
  }
}

/** Key under which best scores are stored. */
export function recordKey(config: GameConfig): string {
  const mode = config.mode === 'capitals' ? `capitals-${config.capDirection}` : config.mode;
  return `${mode}|${config.region}|L${config.level}|${config.difficulty}|${config.count}`;
}

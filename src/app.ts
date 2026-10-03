import { getCountry, type RegionId } from './data/countries';
import { REGIONS, getRegion } from './data/regions';
import { Game, hintPrefix, questionPool, recordKey, type AnswerOutcome, type GameConfig, type Hint, type Mode } from './game/engine';
import { capitalName, collator, countryName, dir, fmt, fmtClock, fmtPercent, getLang, setLocale, t, tNode, type Lang } from './i18n';
import { DIFFICULTY, GameTimer, type Difficulty } from './lib/scoring';
import { loadBest, loadSettings, saveSettings, submitBest, type Settings } from './lib/storage';
import type { GeoMap } from './map/GeoMap';
import { confetti } from './ui/confetti';
import { bdi, h, pulseClass, svg } from './ui/dom';
import { icons } from './ui/icons';
import { setMuted, sfx } from './ui/sound';

const MODES: { id: Mode; icon: string }[] = [
  { id: 'find', icon: icons.pointer },
  { id: 'type', icon: icons.keyboard },
  { id: 'choice', icon: icons.list },
  { id: 'capitals', icon: icons.city },
];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const COUNTS = [10, 20, 0];

const DELAY_CORRECT = 900;
const DELAY_REVEAL = 1900;

export class App {
  private settings: Settings;
  private readonly header = h('header', { class: 'topbar' });
  private readonly main = h('main', { id: 'main', class: 'main', tabindex: '-1' });
  private readonly announcer = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  private map: GeoMap | null = null;
  private mapModule: Promise<typeof import('./map/GeoMap')> | null = null;
  private startToken = 0;
  private game: Game | null = null;
  private timer: GameTimer | null = null;
  private tickHandle = 0;
  private nextHandle = 0;
  private screen: 'home' | 'game' = 'home';
  private dialog: HTMLDialogElement | null = null;
  private lastResult: { record: boolean; previousBest: number | null } | null = null;
  private hintText = '';
  private feedback: { kind: 'ok' | 'bad' | 'info'; node: () => DocumentFragment | string } | null = null;

  constructor(private readonly root: HTMLElement) {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const browserLang: Lang = navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
    this.settings = loadSettings({ lang: browserLang, theme: prefersDark ? 'dark' : 'light', numerals: 'arab', muted: false });
    setMuted(this.settings.muted);
    root.replaceChildren(h('a', { class: 'skip-link', href: '#main' }), this.header, this.main, this.announcer);
    document.addEventListener('visibilitychange', () => {
      if (!this.timer || !this.game || this.game.isOver) return;
      if (document.hidden) this.timer.pause();
      else this.timer.start();
    });
    this.applyLocale();
    this.renderHome();
  }

  // ───────────────────────── settings & chrome ─────────────────────────

  private persist(): void {
    saveSettings(this.settings);
  }

  private applyLocale(): void {
    const { lang, numerals, theme } = this.settings;
    setLocale(lang, numerals);
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir(lang);
    html.dataset.theme = theme;
    document.title = t('app.documentTitle');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f4f7fb');
    const skip = this.root.querySelector('.skip-link');
    if (skip) skip.textContent = t('app.skipToContent');
    this.renderHeader();
  }

  private renderHeader(): void {
    const { lang, theme, muted, numerals } = this.settings;
    const iconBtn = (cls: string, label: string, icon: string, onclick: () => void, pressed?: boolean) =>
      h('button', { type: 'button', class: `btn-icon ${cls}`, 'aria-label': label, title: label, 'aria-pressed': pressed === undefined ? null : String(pressed), onclick }, svg(icon));

    const numeralsBtn =
      lang === 'ar'
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn-chip numerals-toggle',
              title: numerals === 'arab' ? t('header.numeralsLatn') : t('header.numeralsArab'),
              'aria-label': `${t('header.numerals')}: ${numerals === 'arab' ? t('header.numeralsArab') : t('header.numeralsLatn')}`,
              onclick: () => {
                this.settings.numerals = numerals === 'arab' ? 'latn' : 'arab';
                this.persist();
                this.refreshLanguage();
              },
            },
            numerals === 'arab' ? '١٢٣' : '123',
          )
        : null;

    this.header.replaceChildren(
      h(
        'div',
        { class: 'brand' },
        h('span', { class: 'brand-logo' }, svg(icons.globe)),
        h('span', { class: 'brand-name' }, t('app.name')),
      ),
      h(
        'div',
        { class: 'topbar-actions' },
        numeralsBtn,
        iconBtn('sound-toggle', muted ? t('header.soundOn') : t('header.soundOff'), muted ? icons.soundOff : icons.soundOn, () => {
          this.settings.muted = !muted;
          setMuted(this.settings.muted);
          this.persist();
          this.renderHeader();
          sfx.click();
        }, !muted),
        iconBtn('theme-toggle', theme === 'dark' ? t('header.themeLight') : t('header.themeDark'), theme === 'dark' ? icons.sun : icons.moon, () => {
          this.settings.theme = theme === 'dark' ? 'light' : 'dark';
          this.persist();
          this.applyLocale();
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'btn-chip lang-toggle',
            lang: lang === 'ar' ? 'en' : 'ar',
            'aria-label': t('header.switchLanguageLabel'),
            onclick: () => {
              this.settings.lang = lang === 'ar' ? 'en' : 'ar';
              this.persist();
              this.refreshLanguage();
            },
          },
          svg(icons.globe),
          h('span', {}, t('header.switchLanguage')),
        ),
      ),
    );
  }

  /** Language / numerals changed: re-render everything in place without reloading. */
  private refreshLanguage(): void {
    const active = document.activeElement as HTMLElement | null;
    const activeClass = active?.classList.contains('lang-toggle') ? '.lang-toggle' : active?.classList.contains('numerals-toggle') ? '.numerals-toggle' : null;
    this.applyLocale();
    if (this.screen === 'home') this.renderHome();
    else this.refreshGameTexts();
    if (activeClass) this.header.querySelector<HTMLElement>(activeClass)?.focus();
  }

  // ───────────────────────── home ─────────────────────────

  private renderHome(): void {
    this.screen = 'home';
    const cfg = this.settings.config;

    const radioGroup = <T extends string | number>(
      name: string,
      legend: string,
      items: { value: T; content: (Node | string)[]; extraClass?: string }[],
      current: T,
      groupClass: string,
      onChange: (v: T) => void,
    ) =>
      h(
        'fieldset',
        { class: `group ${groupClass}` },
        h('legend', {}, legend),
        h(
          'div',
          { class: 'options' },
          ...items.map((item) => {
            const input = h('input', {
              type: 'radio',
              name,
              value: String(item.value),
              checked: item.value === current,
              onchange: () => onChange(item.value),
            });
            return h('label', { class: `option ${item.extraClass ?? ''}` }, input, h('span', { class: 'option-body' }, ...item.content));
          }),
        ),
      );

    const update = (patch: Partial<GameConfig>) => {
      this.settings.config = { ...this.settings.config, ...patch };
      this.persist();
      this.updateHomeDynamic();
    };

    const modeGroup = radioGroup<Mode>(
      'mode',
      t('home.chooseMode'),
      MODES.map((m) => ({
        value: m.id,
        extraClass: 'mode-card',
        content: [h('span', { class: 'mode-icon' }, svg(m.icon)), h('span', { class: 'mode-title' }, t(`mode.${m.id}.title`)), h('span', { class: 'mode-desc' }, t(`mode.${m.id}.desc`))],
      })),
      cfg.mode,
      'mode-group',
      (mode) => update({ mode }),
    );

    const capOptions = h(
      'div',
      { class: 'cap-options', hidden: cfg.mode !== 'capitals' },
      radioGroup('capDirection', t('home.capDirection'), (['toCapital', 'toCountry'] as const).map((v) => ({ value: v, content: [t(`capDirection.${v}`)] })), cfg.capDirection, 'segmented', (capDirection) => update({ capDirection })),
      radioGroup('capInput', t('home.capInput'), (['choice', 'type'] as const).map((v) => ({ value: v, content: [t(`capInput.${v}`)] })), cfg.capInput, 'segmented', (capInput) => update({ capInput })),
    );

    const regionGroup = radioGroup<RegionId>(
      'region',
      t('home.chooseRegion'),
      REGIONS.map((r) => ({
        value: r.id,
        extraClass: 'region-chip',
        content: [h('span', { class: 'region-emoji', 'aria-hidden': 'true' }, r.icon), h('span', { class: 'region-name' }, t(`region.${r.id}`)), h('span', { class: 'region-count', 'data-region': r.id }, '')],
      })),
      cfg.region,
      'region-group',
      (region) => update({ region }),
    );

    const diffGroup = radioGroup<Difficulty>(
      'difficulty',
      t('home.difficulty'),
      DIFFICULTIES.map((d) => ({ value: d, extraClass: `diff-${d}`, content: [t(`difficulty.${d}.title`)] })),
      cfg.difficulty,
      'segmented',
      (difficulty) => update({ difficulty }),
    );
    diffGroup.append(h('p', { class: 'group-hint', id: 'difficulty-desc' }));

    const countGroup = radioGroup<number>(
      'count',
      t('home.questions'),
      COUNTS.map((n) => ({ value: n, content: [n === 0 ? t('home.all') : fmt(n)] })),
      cfg.count,
      'segmented',
      (count) => update({ count }),
    );

    const form = h(
      'form',
      {
        class: 'setup',
        onsubmit: (e: Event) => {
          e.preventDefault();
          sfx.click();
          void this.startGame(this.settings.config);
        },
      },
      h('div', { class: 'panel' }, modeGroup, capOptions),
      h('div', { class: 'panel' }, regionGroup),
      h('div', { class: 'panel panel-row' }, diffGroup, countGroup),
      h(
        'div',
        { class: 'start-row' },
        h('p', { class: 'best-score', id: 'best-score' }),
        h('button', { type: 'submit', class: 'btn btn-primary btn-start' }, h('span', {}, t('home.start')), svg(icons.forward)),
      ),
    );

    const hero = h(
      'section',
      { class: 'hero' },
      h('div', { class: 'hero-text' }, h('h1', {}, t('app.name')), h('p', {}, t('app.tagline'))),
      h('div', { class: 'hero-art', 'aria-hidden': 'true' }, svg(icons.globe)),
    );

    this.main.replaceChildren(h('div', { class: 'home' }, hero, form));
    this.updateHomeDynamic();
    window.setTimeout(() => void this.loadMapModule(), 300);
  }

  /** Update the parts of the home screen that depend on the current selection (keeps focus). */
  private updateHomeDynamic(): void {
    const cfg = this.settings.config;
    const capOptions = this.main.querySelector<HTMLElement>('.cap-options');
    if (capOptions) capOptions.hidden = cfg.mode !== 'capitals';
    for (const span of this.main.querySelectorAll<HTMLElement>('.region-count')) {
      const region = span.dataset.region as RegionId;
      span.textContent = t('home.countries', { count: questionPool({ mode: cfg.mode, region }).length });
    }
    const rules = DIFFICULTY[cfg.difficulty];
    const desc = this.main.querySelector('#difficulty-desc');
    if (desc) desc.textContent = t(`difficulty.${cfg.difficulty}.desc`, { attempts: rules.attempts, hints: rules.hints, seconds: rules.secondsPerQuestion });
    const best = loadBest(recordKey(cfg));
    const bestEl = this.main.querySelector('#best-score');
    if (bestEl) {
      bestEl.replaceChildren(svg(icons.star), best ? tNode('home.best', { score: best.score }) : t('home.noBest'));
      bestEl.classList.toggle('has-best', Boolean(best));
    }
  }

  // ───────────────────────── game ─────────────────────────

  /** The map module (with the ~750 KB world topology) is loaded lazily on first use. */
  private loadMapModule(): Promise<typeof import('./map/GeoMap')> {
    this.mapModule ??= import('./map/GeoMap');
    return this.mapModule;
  }

  private async ensureMap(): Promise<GeoMap> {
    if (!this.map) {
      const { GeoMap } = await this.loadMapModule();
      this.map ??= new GeoMap(this.mapLabels());
      this.map.onSelect((id) => this.onMapSelect(id));
      this.map.onLayout(() => this.autoZoom());
    }
    return this.map;
  }

  private mapLabels() {
    return {
      map: t('game.mapLabel'),
      country: t('game.mapCountry'),
      zoomIn: t('game.zoomIn'),
      zoomOut: t('game.zoomOut'),
      zoomReset: t('game.zoomReset'),
      nameOf: (id: string) => {
        const done = this.game?.results.some((r) => r.id === id);
        return done ? countryName(getCountry(id)) : null;
      },
    };
  }

  private async startGame(config: GameConfig, ids?: string[]): Promise<void> {
    this.stopTimers();
    this.closeDialog();
    const token = ++this.startToken;
    const map = await this.ensureMap();
    if (token !== this.startToken) return;
    this.game = new Game(config, Math.random, ids);
    this.timer = new GameTimer(this.game.rules.secondsPerQuestion);
    this.screen = 'game';
    this.feedback = null;
    this.hintText = '';

    this.main.replaceChildren(
      h(
        'section',
        { class: `game mode-${config.mode} input-${this.game.inputKind}` },
        h(
          'div',
          { class: 'hud' },
          h('button', { type: 'button', class: 'btn-icon btn-quit', onclick: () => this.quit() }, svg(icons.back)),
          h('div', { class: 'prompt' }, h('p', { class: 'prompt-label' }), h('h2', { class: 'prompt-text', tabindex: '-1' })),
          h(
            'div',
            { class: 'stats' },
            h('div', { class: 'stat stat-score' }, svg(icons.star), h('span', { class: 'stat-label' }), h('span', { class: 'stat-value' })),
            h('div', { class: 'stat stat-streak' }, svg(icons.fire), h('span', { class: 'stat-label' }), h('span', { class: 'stat-value' })),
            h('div', { class: 'stat stat-time' }, svg(icons.clock), h('span', { class: 'stat-label' }), h('span', { class: 'stat-value', dir: 'ltr' })),
          ),
        ),
        h(
          'div',
          { class: 'progress' },
          h('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': '0' }, h('div', { class: 'progress-bar' })),
          h('span', { class: 'progress-text' }),
        ),
        h(
          'div',
          { class: 'board' },
          h('div', { class: 'map-area' }, map.root, h('div', { class: 'countdown', hidden: !this.game.rules.secondsPerQuestion }, h('div', { class: 'countdown-bar' })), h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' })),
          h('div', { class: 'answer-panel' }),
        ),
      ),
    );
    map.setRegion(getRegion(config.region), questionPool(config).map((c) => c.id));
    map.setInteractive(this.game.inputKind === 'map');
    map.updateLabels(this.mapLabels());
    this.timer.start();
    this.showQuestion();
    this.tickHandle = window.setInterval(() => this.tick(), 100);
  }

  private get gameEl(): HTMLElement | null {
    return this.main.querySelector('.game');
  }

  private showQuestion(): void {
    const game = this.game;
    const map = this.map;
    if (!game || !map) return;
    map.clearOverlay();
    this.hintText = '';
    this.feedback = null;
    this.renderToast();
    if (game.highlightsTarget) map.setState(game.current.id, 'target');
    this.autoZoom();
    this.timer?.startQuestion();
    this.refreshGameTexts();
    this.renderAnswerPanel(true);
    this.announce(this.promptString());
  }

  /** Zoom on tiny highlighted targets; return to the region view otherwise. */
  private autoZoom(): void {
    const game = this.game;
    const map = this.map;
    if (!game || !map || game.isOver) return;
    if (game.highlightsTarget && map.screenSize(game.current.id) < 14) map.zoomTo(game.current.id, 45);
    else if (map.autoZoomed) map.resetView();
  }

  private promptString(): string {
    const game = this.game;
    if (!game) return '';
    const c = game.currentCountry;
    const { mode, capDirection } = game.config;
    if (mode === 'find') return t('game.prompt.find', { name: countryName(c) });
    if (mode === 'capitals') return capDirection === 'toCapital' ? t('game.prompt.toCapital', { name: countryName(c) }) : t('game.prompt.toCountry', { name: capitalName(c) });
    return t(`game.prompt.${mode}`);
  }

  private promptNode(): DocumentFragment {
    const game = this.game!;
    const c = game.currentCountry;
    const { mode, capDirection } = game.config;
    const strong = (text: string) => {
      const f = document.createDocumentFragment();
      f.append(h('strong', { class: 'prompt-name' }, text));
      return f;
    };
    const withName = (key: string, name: string) => {
      const frag = tNode(key, { name });
      const b = frag.querySelector('bdi');
      if (b) b.replaceChildren(strong(name));
      return frag;
    };
    if (mode === 'find') return withName('game.prompt.find', countryName(c));
    if (mode === 'capitals') return capDirection === 'toCapital' ? withName('game.prompt.toCapital', countryName(c)) : withName('game.prompt.toCountry', capitalName(c));
    return tNode(`game.prompt.${mode}`);
  }

  /** Re-render every text of the game screen (used on question change and language change). */
  private refreshGameTexts(): void {
    const game = this.game;
    const el = this.gameEl;
    if (!game || !el) return;
    const map = this.map;
    map?.updateLabels(this.mapLabels());
    el.dataset.q = String(game.index);
    el.dataset.state = game.isOver ? 'over' : game.questionFinished ? 'answered' : 'playing';

    const quit = el.querySelector('.btn-quit');
    quit?.setAttribute('aria-label', t('game.quit'));
    quit?.setAttribute('title', t('game.quit'));

    if (!game.isOver) {
      const labelKey = game.config.mode === 'capitals' ? (game.answerField === 'capital' ? 'capital' : 'country') : game.config.mode;
      el.querySelector('.prompt-label')!.textContent = t(`game.promptLabel.${labelKey}`);
      el.querySelector('.prompt-text')!.replaceChildren(this.promptNode());
    }

    el.querySelector('.stat-score .stat-label')!.textContent = t('game.score');
    el.querySelector('.stat-streak .stat-label')!.textContent = t('game.streak');
    el.querySelector('.stat-time .stat-label')!.textContent = game.rules.secondsPerQuestion ? t('game.timeLeft') : t('game.time');
    this.updateStats();

    const answered = Math.min(game.results.length, game.total);
    const track = el.querySelector('.progress-track')!;
    track.setAttribute('aria-valuemax', String(game.total));
    track.setAttribute('aria-valuenow', String(answered));
    track.setAttribute('aria-label', t('game.question', { current: Math.min(game.index + 1, game.total), total: game.total }));
    (el.querySelector('.progress-bar') as HTMLElement).style.inlineSize = `${(answered / game.total) * 100}%`;
    el.querySelector('.progress-text')!.replaceChildren(tNode('game.question', { current: Math.min(game.index + 1, game.total), total: game.total }));

    this.renderAnswerPanel(false);
    this.renderToast();
    if (this.dialog?.open && this.lastResult) this.renderResults();
  }

  private updateStats(): void {
    const game = this.game;
    const el = this.gameEl;
    if (!game || !el) return;
    el.querySelector('.stat-score .stat-value')!.textContent = fmt(game.score);
    el.querySelector('.stat-streak .stat-value')!.textContent = fmt(game.streak.current);
    el.querySelector('.stat-streak')!.classList.toggle('is-hot', game.streak.current >= 3);
    this.updateClock();
  }

  private updateClock(): void {
    const game = this.game;
    const timer = this.timer;
    const el = this.gameEl;
    if (!game || !timer || !el) return;
    const value = el.querySelector('.stat-time .stat-value');
    const left = timer.secondsLeft();
    if (left !== null) {
      const shown = game.questionFinished ? 0 : left;
      if (value) value.textContent = fmt(Math.ceil(shown));
      const bar = el.querySelector<HTMLElement>('.countdown-bar');
      if (bar) {
        bar.style.inlineSize = `${(shown / game.rules.secondsPerQuestion) * 100}%`;
        bar.classList.toggle('is-low', shown <= 4);
      }
    } else if (value) {
      value.textContent = fmtClock(timer.elapsedMs());
    }
  }

  private tick(): void {
    const game = this.game;
    if (!game || game.isOver) return;
    if (!game.questionFinished && this.timer?.isExpired()) {
      this.handleOutcome(game.timeout(), { timedOut: true });
    }
    this.updateClock();
  }

  private renderAnswerPanel(fresh: boolean): void {
    const game = this.game;
    const panel = this.gameEl?.querySelector<HTMLElement>('.answer-panel');
    if (!game || !panel || game.isOver) return;
    const finished = game.questionFinished;
    const prevInput = panel.querySelector<HTMLInputElement>('.answer-input');
    const prevValue = fresh ? '' : prevInput?.value ?? '';
    const hadFocus = document.activeElement;
    const focusedOption = (hadFocus as HTMLElement | null)?.dataset?.id;

    const parts: Node[] = [];
    const c = game.currentCountry;
    if (game.inputKind === 'choice') {
      const label = (id: string) => {
        const country = getCountry(id);
        return game.answerField === 'capital' ? capitalName(country) : countryName(country);
      };
      const grid = h('div', { class: 'choices', role: 'group', 'aria-label': t('game.promptLabel.choice') });
      for (const id of game.current.options) {
        const removed = game.isOptionRemoved(id);
        const isAnswer = id === c.id;
        const state = finished ? (isAnswer ? 'is-correct' : removed ? 'is-wrong' : '') : removed ? 'is-wrong' : '';
        const btn = h(
          'button',
          {
            type: 'button',
            class: `choice ${state}`,
            'data-id': id,
            disabled: finished || removed,
            onclick: () => this.onChoice(id),
          },
          h('span', { class: 'choice-mark', 'aria-hidden': 'true' }, state === 'is-correct' ? '✓' : state === 'is-wrong' ? '✗' : ''),
          h('span', { class: 'choice-text' }, label(id)),
        );
        grid.append(btn);
      }
      parts.push(grid);
    } else if (game.inputKind === 'text') {
      const inputLabel = game.answerField === 'capital' ? t('game.inputLabelCapital') : t('game.inputLabelCountry');
      const input = h('input', {
        type: 'text',
        class: 'answer-input',
        id: 'answer-input',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        enterkeyhint: 'done',
        placeholder: t('game.inputPlaceholder'),
        'aria-label': inputLabel,
        disabled: finished,
      });
      input.value = prevValue;
      const form = h(
        'form',
        {
          class: 'answer-form',
          onsubmit: (e: Event) => {
            e.preventDefault();
            this.onText(input.value);
          },
        },
        input,
        h('button', { type: 'submit', class: 'btn btn-primary btn-submit', disabled: finished }, t('game.submit')),
      );
      parts.push(form);
    }

    const hintLabel = Number.isFinite(game.hintsLeft) ? t('game.hintsLeft', { count: Math.max(0, game.hintsLeft) }) : t('game.hint');
    const actions = h(
      'div',
      { class: 'actions' },
      game.rules.hints > 0 ? h('button', { type: 'button', class: 'btn btn-ghost btn-hint', disabled: !game.canHint, onclick: () => this.onHint() }, svg(icons.hint), h('span', {}, hintLabel)) : null,
      h('button', { type: 'button', class: 'btn btn-ghost btn-skip', disabled: finished, onclick: () => this.onSkip() }, h('span', {}, t('game.skip')), svg(icons.skip)),
    );
    const hint = this.hintText ? h('p', { class: 'hint-text' }, svg(icons.hint), h('span', {}, this.hintText)) : null;
    if (hint) parts.push(hint);
    parts.push(actions);
    panel.replaceChildren(...parts);

    if (fresh) {
      const first = panel.querySelector<HTMLElement>('.answer-input, .choice:not([disabled])');
      if (first && window.matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
    } else if (focusedOption) {
      panel.querySelector<HTMLElement>(`.choice[data-id="${focusedOption}"]:not([disabled])`)?.focus();
    } else if (hadFocus === prevInput && !finished) {
      panel.querySelector<HTMLInputElement>('.answer-input')?.focus();
    }
  }

  private renderToast(): void {
    const toast = this.gameEl?.querySelector<HTMLElement>('.toast');
    if (!toast) return;
    if (!this.feedback) {
      toast.className = 'toast';
      toast.replaceChildren();
      return;
    }
    toast.className = `toast is-visible toast-${this.feedback.kind}`;
    const icon = this.feedback.kind === 'ok' ? icons.check : this.feedback.kind === 'bad' ? icons.cross : icons.hint;
    toast.replaceChildren(h('span', { class: 'toast-icon' }, svg(icon)), h('span', { class: 'toast-text' }, this.feedback.node()));
  }

  private setFeedback(kind: 'ok' | 'bad' | 'info', node: () => DocumentFragment | string): void {
    this.feedback = { kind, node };
    this.renderToast();
    const toast = this.gameEl?.querySelector('.toast');
    if (toast) pulseClass(toast, 'pop');
  }

  private announce(text: string): void {
    this.announcer.textContent = '';
    window.setTimeout(() => (this.announcer.textContent = text), 30);
  }

  private secondsLeft(): number {
    return this.timer?.secondsLeft() ?? 0;
  }

  private onMapSelect(id: string): void {
    const game = this.game;
    if (!game || game.isOver || game.questionFinished || game.inputKind !== 'map') return;
    const outcome = game.answerId(id, this.secondsLeft());
    if (!outcome.correct) {
      this.map?.flashWrong(id);
      this.map?.showMarker(id, false);
    }
    this.handleOutcome(outcome, { pickedId: id });
  }

  private onChoice(id: string): void {
    const game = this.game;
    if (!game || game.questionFinished) return;
    this.handleOutcome(game.answerId(id, this.secondsLeft()), { pickedId: id });
  }

  private onText(text: string): void {
    const game = this.game;
    if (!game || game.questionFinished || !text.trim()) return;
    const outcome = game.answerText(text, this.secondsLeft());
    if (!outcome.correct && !outcome.finished) {
      const input = this.gameEl?.querySelector<HTMLInputElement>('.answer-input');
      if (input) {
        pulseClass(input, 'shake');
        input.select();
      }
    }
    this.handleOutcome(outcome, {});
  }

  private onSkip(): void {
    const game = this.game;
    if (!game || game.questionFinished) return;
    this.handleOutcome(game.skip(), { skipped: true });
  }

  private onHint(): void {
    const game = this.game;
    const map = this.map;
    if (!game || !map) return;
    const hint: Hint | null = game.useHint();
    if (!hint) return;
    sfx.hint();
    const c = game.currentCountry;
    if (hint.kind === 'area') {
      map.showHintArea(c.id, hint.level);
      this.hintText = t('game.hintArea');
    } else if (hint.kind === 'letters') {
      const answer = game.answerField === 'capital' ? capitalName(c) : countryName(c);
      this.hintText = t('game.hintLetters', { prefix: hintPrefix(answer, hint.level) });
    } else {
      this.hintText = t('game.hintFifty');
    }
    this.renderAnswerPanel(false);
    this.announce(this.hintText);
  }

  private handleOutcome(outcome: AnswerOutcome, info: { pickedId?: string; timedOut?: boolean; skipped?: boolean }): void {
    const game = this.game;
    const map = this.map;
    if (!game || !map) return;
    const c = game.currentCountry;
    const answerName = () => (game.answerField === 'capital' ? capitalName(c) : countryName(c));

    if (outcome.correct) {
      sfx.correct();
      const result = game.results[game.results.length - 1];
      map.setState(c.id, result.attempts === 1 ? 'correct' : 'partial');
      map.showMarker(c.id, true);
      const streak = game.streak.current;
      this.setFeedback('ok', () => {
        const f = document.createDocumentFragment();
        f.append(t('game.correct'), ' ', h('span', { class: 'toast-points' }, t('game.points', { points: outcome.points })));
        if (streak >= 3 && streak % 5 === 0) f.append(' · ', t('game.streakToast', { count: streak }));
        return f;
      });
      const scoreEl = this.gameEl?.querySelector('.stat-score');
      if (scoreEl) pulseClass(scoreEl, 'bump');
      this.announce(`${t('game.correct')} ${t('game.points', { points: outcome.points })}`);
    } else {
      sfx.wrong();
      if (outcome.finished) {
        map.setState(c.id, 'wrong');
        map.showMarker(c.id, false);
        if (map.screenSize(c.id) < 14) map.zoomTo(c.id, 45);
        const lead = info.timedOut ? t('game.timeUp') : t('game.wrong');
        this.setFeedback('bad', () => {
          const f = document.createDocumentFragment();
          f.append(info.timedOut ? t('game.timeUp') : info.skipped ? '' : `${t('game.wrong')} · `, tNode('game.answerWas', { name: answerName() }));
          return f;
        });
        this.announce(`${lead} ${t('game.answerWas', { name: answerName() })}`);
      } else {
        const picked = info.pickedId && game.inputKind === 'map' ? getCountry(info.pickedId) : null;
        this.setFeedback('bad', () => {
          const f = document.createDocumentFragment();
          if (picked) f.append(tNode('game.thatIs', { name: countryName(picked) }), ' · ');
          else f.append(t('game.tryAgain'), ' · ');
          f.append(t('game.attemptsLeft', { count: outcome.attemptsLeft }));
          return f;
        });
        this.announce(`${picked ? t('game.thatIs', { name: countryName(picked) }) : t('game.tryAgain')} ${t('game.attemptsLeft', { count: outcome.attemptsLeft })}`);
      }
    }

    this.updateStats();
    this.renderAnswerPanel(false);
    if (outcome.finished) {
      this.refreshGameTexts();
      window.clearTimeout(this.nextHandle);
      this.nextHandle = window.setTimeout(() => this.advance(), outcome.correct ? DELAY_CORRECT : DELAY_REVEAL);
    }
  }

  private advance(): void {
    const game = this.game;
    const map = this.map;
    if (!game || !map) return;
    const more = game.next();
    if (!more) {
      this.finishGame();
      return;
    }
    this.showQuestion();
  }

  private finishGame(): void {
    const game = this.game;
    if (!game || !this.timer) return;
    this.timer.pause();
    window.clearInterval(this.tickHandle);
    this.map?.setInteractive(false);
    this.map?.resetView();
    this.refreshGameTexts();
    const key = recordKey(game.config);
    const previous = loadBest(key);
    const record = game.score > 0 && submitBest(key, { score: game.score, accuracy: game.accuracy, timeMs: this.timer.elapsedMs(), date: new Date().toISOString() });
    this.lastResult = { record, previousBest: previous?.score ?? null };
    sfx.finish();
    this.openResults();
    if (record || game.accuracy >= 90) confetti();
  }

  // ───────────────────────── results ─────────────────────────

  private openResults(): void {
    if (!this.dialog) {
      this.dialog = h('dialog', { class: 'results', 'aria-labelledby': 'results-title' });
      this.dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        this.goHome();
      });
      document.body.append(this.dialog);
    }
    this.renderResults();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('.btn-primary')?.focus();
  }

  private renderResults(): void {
    const game = this.game;
    const dialog = this.dialog;
    const info = this.lastResult;
    if (!game || !dialog || !info) return;
    dialog.lang = getLang();
    dialog.dir = dir();
    const acc = game.accuracy;
    const verdict = acc === 100 ? 'perfect' : acc >= 80 ? 'great' : acc >= 50 ? 'good' : 'keepGoing';
    const stat = (cls: string, icon: string, label: string, value: string) =>
      h('div', { class: `result-stat ${cls}` }, svg(icon), h('span', { class: 'result-label' }, label), h('span', { class: 'result-value' }, value));

    const mistakes = game.results.filter((r) => !r.correct || r.attempts > 1);
    const sorter = collator();
    mistakes.sort((a, b) => sorter.compare(countryName(getCountry(a.id)), countryName(getCountry(b.id))));
    const showCapital = game.config.mode === 'capitals';
    const list = mistakes.length
      ? h(
          'ul',
          { class: 'mistake-list' },
          ...mistakes.map((r) => {
            const c = getCountry(r.id);
            const missed = !r.correct;
            return h(
              'li',
              { class: `mistake ${missed ? 'is-missed' : 'is-late'}` },
              h('span', { class: 'mistake-mark', 'aria-hidden': 'true' }, missed ? '✗' : '◐'),
              h('span', { class: 'mistake-name' }, bdi(countryName(c))),
              showCapital ? h('span', { class: 'mistake-capital' }, bdi(capitalName(c))) : null,
              h('span', { class: 'sr-only' }, missed ? t('results.missed') : t('results.lateCorrect')),
            );
          }),
        )
      : h('p', { class: 'no-mistakes' }, svg(icons.check), t('results.noMistakes'));

    dialog.replaceChildren(
      h(
        'div',
        { class: 'results-card' },
        h('div', { class: 'results-head' }, h('h2', { id: 'results-title' }, t('results.title')), h('p', { class: 'verdict' }, t(`results.${verdict}`)), info.record ? h('p', { class: 'record-badge' }, svg(icons.star), t('results.newRecord')) : null),
        h(
          'div',
          { class: 'result-stats' },
          stat('rs-score', icons.star, t('results.score'), fmt(game.score)),
          stat('rs-accuracy', icons.target, t('results.accuracy'), fmtPercent(acc)),
          stat('rs-time', icons.clock, t('results.time'), fmtClock(this.timer?.elapsedMs() ?? 0)),
          stat('rs-streak', icons.fire, t('results.bestStreak'), fmt(game.streak.best)),
        ),
        info.previousBest !== null && !info.record ? h('p', { class: 'previous-best' }, tNode('results.previousBest', { score: info.previousBest })) : null,
        h('h3', { class: 'mistakes-title' }, t('results.mistakes')),
        list,
        h(
          'div',
          { class: 'results-actions' },
          mistakes.length ? h('button', { type: 'button', class: 'btn btn-primary btn-retry-mistakes', onclick: () => void this.startGame(game.config, mistakes.map((m) => m.id)) }, svg(icons.retry), h('span', {}, t('results.retryMistakes'))) : null,
          h('button', { type: 'button', class: `btn ${mistakes.length ? 'btn-secondary' : 'btn-primary'} btn-play-again`, onclick: () => void this.startGame(game.config) }, svg(icons.retry), h('span', {}, t('results.playAgain'))),
          h('button', { type: 'button', class: 'btn btn-ghost btn-menu', onclick: () => this.goHome() }, svg(icons.home), h('span', {}, t('results.menu'))),
        ),
      ),
    );
  }

  private closeDialog(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  private stopTimers(): void {
    window.clearInterval(this.tickHandle);
    window.clearTimeout(this.nextHandle);
  }

  private quit(): void {
    sfx.click();
    this.goHome();
  }

  private goHome(): void {
    this.startToken += 1;
    this.stopTimers();
    this.closeDialog();
    this.game = null;
    this.timer = null;
    this.lastResult = null;
    this.renderHome();
    this.main.focus({ preventScroll: true });
  }
}

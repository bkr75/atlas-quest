import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldTopo from '../data/world.topo.json';
import type { RegionDef } from '../data/regions';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Countries smaller than this (projected area in px² at zoom 1) get a helper circle. */
const TINY_AREA = 28;
/** Helper circle radius in screen pixels (smaller on phones, where they are denser). */
const helperRadius = () => (window.innerWidth < 600 ? 5 : 7);

export type CountryState = 'target' | 'correct' | 'partial' | 'wrong' | 'reveal' | 'flash-wrong';

interface CountryShape {
  id: string;
  territory: boolean;
  feature: Feature<Geometry>;
  el: SVGPathElement;
  helper?: SVGCircleElement;
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
  area: number;
}

export interface GeoMapLabels {
  map: string;
  country: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  /** Accessible name of a country once it may be revealed (answered), or null to keep it secret. */
  nameOf: (id: string) => string | null;
}

/** Largest polygon of a (multi)polygon feature: its centroid is a better anchor than the whole feature's. */
function mainPolygon(f: Feature<Geometry>): Feature<Polygon> | Feature<Geometry> {
  if (f.geometry.type !== 'MultiPolygon') return f;
  let best: Polygon | null = null;
  let bestArea = -1;
  const path = geoPath();
  for (const coords of f.geometry.coordinates) {
    const poly: Polygon = { type: 'Polygon', coordinates: coords };
    const a = path.area(poly);
    if (a > bestArea) {
      bestArea = a;
      best = poly;
    }
  }
  return best ? { type: 'Feature', properties: {}, geometry: best } : f;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export class GeoMap {
  readonly root: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly viewport: SVGGElement;
  private readonly helpersLayer: SVGGElement;
  private readonly overlay: SVGGElement;
  private readonly shapes = new Map<string, CountryShape>();
  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private readonly svgSel: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly controls: HTMLDivElement;
  private projection: GeoProjection = geoNaturalEarth1();
  private region: RegionDef | null = null;
  private playable = new Set<string>();
  private states = new Map<string, CountryState>();
  private width = 800;
  private height = 450;
  private k = 1;
  /** Initial view of the region (zoomed in on narrow/portrait screens). */
  private home: ZoomTransform = zoomIdentity;
  private interactive = false;
  private selectHandler: (id: string) => void = () => {};
  private layoutHandler: () => void = () => {};
  private resizeObserver: ResizeObserver;
  private labels: GeoMapLabels;
  autoZoomed = false;

  constructor(labels: GeoMapLabels) {
    this.labels = labels;
    this.root = document.createElement('div');
    this.root.className = 'map-wrap';
    this.svg = el('svg', { class: 'map', role: 'group' });
    const defs = el('defs');
    const pattern = el('pattern', { id: 'hatch', patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' });
    pattern.append(el('rect', { width: 6, height: 6, class: 'hatch-bg' }), el('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'hatch-line' }));
    defs.append(pattern);
    this.viewport = el('g', { class: 'viewport' });
    const land = el('g', { class: 'land' });
    this.helpersLayer = el('g', { class: 'helpers' });
    this.overlay = el('g', { class: 'overlay' });
    this.viewport.append(land, this.helpersLayer, this.overlay);
    this.svg.append(defs, el('rect', { class: 'ocean', width: '100%', height: '100%' }), this.viewport);

    const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection<{ name?: string; territory?: boolean }> }>;
    const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name?: string; territory?: boolean }>;
    for (const f of fc.features) {
      const id = String(f.id);
      const territory = Boolean(f.properties?.territory);
      const path = el('path', { class: territory ? 'territory' : 'country', 'data-id': id });
      land.append(path);
      this.shapes.set(id, { id, territory, feature: f, el: path, centroid: [0, 0], bounds: [[0, 0], [0, 0]], area: 0 });
    }

    this.controls = document.createElement('div');
    this.controls.className = 'map-controls';
    this.root.append(this.svg, this.controls);
    this.renderControls();

    this.svgSel = select(this.svg);
    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 80])
      .clickDistance(6)
      .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => this.applyTransform(e.transform));
    this.svgSel.call(this.zoomBehavior).on('dblclick.zoom', null);

    this.svg.addEventListener('click', (e) => this.onClick(e));
    this.svg.addEventListener('keydown', (e) => this.onKey(e));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.updateLabels(labels);
  }

  onSelect(handler: (id: string) => void): void {
    this.selectHandler = handler;
  }

  /** Called after the map was re-projected because its container was resized. */
  onLayout(handler: () => void): void {
    this.layoutHandler = handler;
  }

  /** Show a region: fits the view and marks which countries are in play. */
  setRegion(region: RegionDef, playableIds: Iterable<string>): void {
    this.region = region;
    this.playable = new Set(playableIds);
    this.clearStates();
    for (const s of this.shapes.values()) {
      const inPlay = this.playable.has(s.id);
      s.el.classList.toggle('playable', inPlay);
      s.el.classList.toggle('inactive', !inPlay);
    }
    this.layout();
    this.resetView(false);
  }

  setInteractive(on: boolean): void {
    this.interactive = on;
    this.svg.classList.toggle('is-interactive', on);
    this.refreshA11y();
  }

  setState(id: string, state: CountryState | null): void {
    const s = this.shapes.get(id);
    if (!s) return;
    const prev = this.states.get(id);
    if (prev) {
      s.el.classList.remove(`is-${prev}`);
      s.helper?.classList.remove(`is-${prev}`);
    }
    if (state) {
      this.states.set(id, state);
      s.el.classList.add(`is-${state}`);
      s.helper?.classList.add(`is-${state}`);
      // Keep highlighted shapes above their neighbours so the outline is fully visible.
      s.el.parentNode?.appendChild(s.el);
    } else {
      this.states.delete(id);
    }
    this.refreshA11y(id);
  }

  /** Briefly mark a wrong pick. */
  flashWrong(id: string): void {
    if (this.states.get(id)) return;
    this.setState(id, 'flash-wrong');
    window.setTimeout(() => {
      if (this.states.get(id) === 'flash-wrong') this.setState(id, null);
    }, 900);
  }

  clearStates(): void {
    for (const id of [...this.states.keys()]) this.setState(id, null);
    this.clearOverlay();
  }

  clearOverlay(): void {
    this.overlay.replaceChildren();
  }

  /** ✓ / ✗ badge at the country's centroid (constant size on screen). */
  showMarker(id: string, ok: boolean): void {
    const s = this.shapes.get(id);
    if (!s) return;
    const g = el('g', { class: `marker ${ok ? 'marker-ok' : 'marker-bad'}`, 'data-x': s.centroid[0], 'data-y': s.centroid[1], 'aria-hidden': 'true' });
    g.append(el('circle', { r: 11 }));
    const text = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    text.textContent = ok ? '✓' : '✗';
    g.append(text);
    this.overlay.append(g);
    this.positionOverlay();
    window.setTimeout(() => g.remove(), 1600);
  }

  /** Dashed circle around the target (level 2 = tighter circle). */
  showHintArea(id: string, level: number, rng: () => number = Math.random): void {
    const s = this.shapes.get(id);
    if (!s) return;
    this.overlay.querySelectorAll('.hint-area').forEach((n) => n.remove());
    const [[x0, y0], [x1, y1]] = s.bounds;
    const own = Math.hypot(x1 - x0, y1 - y0) / 2;
    const minR = (level >= 2 ? 30 : 70) / this.k;
    const r = Math.max(own * (level >= 2 ? 1.3 : 2.2), minR);
    const slack = Math.max(0, r - own) * 0.6;
    const angle = rng() * Math.PI * 2;
    const cx = s.centroid[0] + Math.cos(angle) * slack * rng();
    const cy = s.centroid[1] + Math.sin(angle) * slack * rng();
    const circle = el('circle', { class: 'hint-area', cx, cy, r });
    this.overlay.prepend(circle);
  }

  /** Projected size of a country on screen (px, max of width/height). */
  screenSize(id: string): number {
    const s = this.shapes.get(id);
    if (!s) return 0;
    const [[x0, y0], [x1, y1]] = s.bounds;
    return Math.max(x1 - x0, y1 - y0) * this.k;
  }

  /** Smoothly zoom so the country spans about `targetPx` pixels. */
  zoomTo(id: string, targetPx = 90, animate = true): void {
    const s = this.shapes.get(id);
    if (!s) return;
    const [[x0, y0], [x1, y1]] = s.bounds;
    const size = Math.max(x1 - x0, y1 - y0, 0.5);
    const k = Math.min(60, Math.max(1, targetPx / size));
    const [cx, cy] = s.centroid;
    const t = zoomIdentity.translate(this.width / 2, this.height / 2).scale(k).translate(-cx, -cy);
    this.autoZoomed = true;
    this.transformTo(t, animate);
  }

  resetView(animate = true): void {
    this.autoZoomed = false;
    this.transformTo(this.home, animate);
  }

  zoomBy(factor: number): void {
    const sel = this.reducedMotion() ? this.svgSel : this.svgSel.transition().duration(250);
    this.zoomBehavior.scaleBy(sel as never, factor);
  }

  updateLabels(labels: GeoMapLabels): void {
    this.labels = labels;
    this.svg.setAttribute('aria-label', labels.map);
    this.renderControls();
    this.refreshA11y();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  // ───────────────────────── internals ─────────────────────────

  private renderControls(): void {
    const mk = (cls: string, label: string, symbol: string, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `map-btn ${cls}`;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.textContent = symbol;
      b.addEventListener('click', fn);
      return b;
    };
    this.controls.replaceChildren(
      mk('zoom-in', this.labels.zoomIn, '+', () => this.zoomBy(1.6)),
      mk('zoom-out', this.labels.zoomOut, '−', () => this.zoomBy(1 / 1.6)),
      mk('zoom-reset', this.labels.zoomReset, '⟲', () => this.resetView()),
    );
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private transformTo(t: ZoomTransform, animate: boolean): void {
    if (animate && !this.reducedMotion()) {
      this.svgSel.transition().duration(650).call(this.zoomBehavior.transform as never, t);
    } else {
      this.zoomBehavior.transform(this.svgSel, t);
    }
  }

  private applyTransform(t: ZoomTransform): void {
    this.k = t.k;
    this.viewport.setAttribute('transform', t.toString());
    this.svg.style.setProperty('--k', String(t.k));
    for (const s of this.shapes.values()) {
      if (!s.helper) continue;
      s.helper.setAttribute('r', String(helperRadius() / t.k));
      // Hide the helper once the country itself is big enough to tap.
      s.helper.style.display = s.area * t.k * t.k < TINY_AREA * 2 ? '' : 'none';
    }
    this.positionOverlay();
  }

  private positionOverlay(): void {
    for (const g of this.overlay.querySelectorAll<SVGGElement>('.marker')) {
      g.setAttribute('transform', `translate(${g.dataset.x},${g.dataset.y}) scale(${1 / this.k})`);
    }
  }

  private resize(): void {
    const { width, height } = this.root.getBoundingClientRect();
    if (width < 10 || height < 10) return;
    if (Math.abs(width - this.width) < 1 && Math.abs(height - this.height) < 1) return;
    this.layout();
    this.resetView(false);
    this.layoutHandler();
  }

  /** (Re)project every shape for the current region and container size. */
  private layout(): void {
    const region = this.region;
    if (!region) return;
    const rect = this.root.getBoundingClientRect();
    this.width = Math.max(rect.width, 200);
    this.height = Math.max(rect.height, 160);
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);

    const [[w, s], [e, n]] = region.bounds;
    const grid: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) grid.push([w + ((e - w) * i) / 8, s + ((n - s) * j) / 8]);
    }
    const pad = Math.min(this.width, this.height) * 0.04;
    this.projection = geoNaturalEarth1()
      .rotate([region.rotate, 0])
      .fitExtent(
        [
          [pad, pad],
          [this.width - pad, this.height - pad],
        ],
        { type: 'MultiPoint', coordinates: grid } as GeoPermissibleObjects,
      );
    const path = geoPath(this.projection);

    // On portrait screens the region would be a thin strip: start zoomed in so it fills more height.
    const pts = grid.map((p) => this.projection(p)).filter((p): p is [number, number] => Boolean(p));
    const ys = pts.map((p) => p[1]);
    const xs = pts.map((p) => p[0]);
    const regionH = Math.max(...ys) - Math.min(...ys);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const homeK = regionH > 0 && regionH < this.height * 0.6 ? Math.min(1.8, (this.height * 0.7) / regionH) : 1;
    this.home = homeK > 1.05 ? zoomIdentity.translate(this.width / 2, this.height / 2).scale(homeK).translate(-cx, -cy) : zoomIdentity;

    this.helpersLayer.replaceChildren();
    const helperShapes: CountryShape[] = [];
    for (const shape of this.shapes.values()) {
      shape.el.setAttribute('d', path(shape.feature) ?? '');
      shape.area = path.area(shape.feature);
      const main = mainPolygon(shape.feature);
      const c = path.centroid(main);
      shape.centroid = Number.isFinite(c[0]) ? c : [0, 0];
      shape.bounds = path.bounds(main) as [[number, number], [number, number]];
      shape.helper = undefined;
      if (!shape.territory && this.playable.has(shape.id) && shape.area < TINY_AREA) helperShapes.push(shape);
    }
    for (const shape of helperShapes) {
      const circle = el('circle', { class: 'helper', 'data-id': shape.id, cx: shape.centroid[0], cy: shape.centroid[1], r: helperRadius() / this.k });
      const state = this.states.get(shape.id);
      if (state) circle.classList.add(`is-${state}`);
      shape.helper = circle;
      this.helpersLayer.append(circle);
    }

    // Keyboard order: west → east.
    const land = this.viewport.querySelector('.land');
    if (land) {
      const ordered = [...this.shapes.values()]
        .filter((s) => this.playable.has(s.id))
        .sort((a, b) => a.centroid[0] - b.centroid[0]);
      for (const s of ordered) land.append(s.el);
    }

    // Allow panning over the whole projected world plus a margin.
    const sphere = path.bounds({ type: 'Sphere' });
    const mx = this.width * 0.5;
    const my = this.height * 0.5;
    this.zoomBehavior.translateExtent([
      [Math.min(0, sphere[0][0]) - mx, Math.min(0, sphere[0][1]) - my],
      [Math.max(this.width, sphere[1][0]) + mx, Math.max(this.height, sphere[1][1]) + my],
    ]);
    this.zoomBehavior.extent([
      [0, 0],
      [this.width, this.height],
    ]);
    this.refreshA11y();
  }

  private refreshA11y(only?: string): void {
    const list = only ? [this.shapes.get(only)].filter(Boolean) as CountryShape[] : [...this.shapes.values()];
    for (const s of list) {
      if (s.territory) {
        s.el.setAttribute('aria-hidden', 'true');
        continue;
      }
      const focusable = this.interactive && this.playable.has(s.id);
      if (focusable) {
        s.el.setAttribute('tabindex', '0');
        s.el.setAttribute('role', 'button');
        s.el.setAttribute('aria-label', this.labels.nameOf(s.id) ?? this.labels.country);
        s.el.removeAttribute('aria-hidden');
      } else {
        s.el.removeAttribute('tabindex');
        s.el.removeAttribute('role');
        s.el.removeAttribute('aria-label');
        s.el.setAttribute('aria-hidden', 'true');
      }
      s.helper?.setAttribute('aria-hidden', 'true');
    }
  }

  private idFromEvent(e: Event): string | null {
    const target = (e.target as Element | null)?.closest?.('[data-id]');
    const id = target?.getAttribute('data-id');
    return id && this.playable.has(id) ? id : null;
  }

  private onClick(e: MouseEvent): void {
    if (!this.interactive) return;
    const id = this.idFromEvent(e);
    if (id) this.selectHandler(id);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.interactive) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = this.idFromEvent(e);
    if (id) {
      e.preventDefault();
      this.selectHandler(id);
    }
  }
}

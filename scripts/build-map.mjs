// Builds src/data/world.topo.json from Natural Earth (world-atlas, 1:50m).
//
// - Re-keys every playable country by its ISO alpha-2 code (see src/data/countries.ts).
// - Merges a few Natural Earth sub-units into the internationally recognised country
//   (Somaliland -> Somalia, N. Cyprus -> Cyprus, Ashmore and Cartier Is. -> Australia,
//   Siachen Glacier -> India region is left as a non-playable territory).
// - Every other feature (dependent territories, Western Sahara, ...) is kept as a
//   non-playable "territory" so the map still looks complete.
// - Antarctica is dropped.
//
// Run with: npm run build:map
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mergeArcs } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));

// Minimal parse of the TS data file (numeric code -> alpha-2) so the script has no TS dependency.
const src = readFileSync(new URL('../src/data/countries.ts', import.meta.url), 'utf8');
const numToIso = new Map();
for (const m of src.matchAll(/c\('([A-Z]{2})', '(\d{3})?'/g)) {
  if (m[2]) numToIso.set(m[2], m[1]);
}

// Natural Earth names (with no numeric code) that map onto a playable country.
const NAME_TO_ISO = { Kosovo: 'XK' };
// Sub-units merged into a recognised country.
const MERGE_INTO = { Somaliland: 'SO', 'N. Cyprus': 'CY', 'Ashmore and Cartier Is.': 'AU' };
const DROP = new Set(['Antarctica']);

const groups = new Map(); // iso -> geometries[]
const territories = [];

for (const g of topo.objects.countries.geometries) {
  const name = g.properties?.name;
  if (DROP.has(name)) continue;
  let iso = MERGE_INTO[name] ?? NAME_TO_ISO[name];
  if (!iso && g.id !== undefined && name !== 'Ashmore and Cartier Is.') iso = numToIso.get(g.id);
  if (iso) {
    if (!groups.has(iso)) groups.set(iso, []);
    groups.get(iso).push(g);
  } else {
    territories.push({ type: g.type, arcs: g.arcs, id: `T-${territories.length}`, properties: { name, territory: true } });
  }
}

const geometries = [];
for (const [iso, list] of groups) {
  const merged = list.length === 1 ? list[0] : mergeArcs(topo, list);
  geometries.push({ type: merged.type, arcs: merged.arcs, id: iso, properties: {} });
}

const missing = [...numToIso.values(), 'XK'].filter((iso) => !groups.has(iso));
if (missing.length) {
  console.error('Countries without a map feature:', missing.join(', '));
  process.exit(1);
}

const out = {
  type: 'Topology',
  bbox: topo.bbox,
  transform: topo.transform,
  objects: { countries: { type: 'GeometryCollection', geometries: [...territories, ...geometries] } },
  arcs: topo.arcs,
};
writeFileSync(new URL('../src/data/world.topo.json', import.meta.url), JSON.stringify(out));
console.log(`Wrote ${geometries.length} countries + ${territories.length} territories.`);
console.log('Territories:', territories.map((t) => t.properties.name).join(', '));

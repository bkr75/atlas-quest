import { COUNTRIES, type Country, type RegionId } from './countries';

export interface RegionDef {
  id: RegionId;
  /** Emoji shown on the region chip (decorative). */
  icon: string;
  /** Map view: [[west, south], [east, north]] in degrees. */
  bounds: [[number, number], [number, number]];
  /** Projection rotation (longitude of the map centre is -rotate). */
  rotate: number;
}

export const REGIONS: RegionDef[] = [
  { id: 'world', icon: '🌍', bounds: [[-170, -57], [190, 80]], rotate: -10 },
  { id: 'arab', icon: '🕌', bounds: [[-18, -13], [62, 38]], rotate: -20 },
  { id: 'gulf', icon: '🌴', bounds: [[34, 12], [60, 32]], rotate: -47 },
  { id: 'africa', icon: '🦁', bounds: [[-26, -36], [58, 38]], rotate: -15 },
  { id: 'asia', icon: '🏯', bounds: [[25, -11], [150, 56]], rotate: -90 },
  { id: 'europe', icon: '🏰', bounds: [[-25, 34], [45, 71]], rotate: -10 },
  { id: 'namerica', icon: '🗽', bounds: [[-170, 7], [-52, 72]], rotate: 100 },
  { id: 'samerica', icon: '🦜', bounds: [[-92, -56], [-34, 13]], rotate: 60 },
  { id: 'oceania', icon: '🏝️', bounds: [[110, -48], [195, 10]], rotate: -160 },
];

export function getRegion(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

export function countriesInRegion(region: RegionId): Country[] {
  if (region === 'world') return COUNTRIES;
  return COUNTRIES.filter((c) => c.regions.includes(region));
}

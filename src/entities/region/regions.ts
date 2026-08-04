import type { GeographicBounds } from '@/entities/earthquake/model/types';

export type RegionPresetId =
  'peru' | 'peru-coast' | 'peru-highlands' | 'peru-amazon' | 'pacific-ring' | 'world';

export interface RegionPreset {
  readonly id: RegionPresetId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly bounds: GeographicBounds | null;
  readonly approximate: boolean;
  readonly mapCenter: readonly [number, number];
  readonly mapZoom: number;
}

export const REGION_PRESETS: Readonly<Record<RegionPresetId, RegionPreset>> = {
  peru: {
    id: 'peru',
    label: 'Perú',
    shortLabel: 'Perú',
    description: 'Rectángulo geográfico que cubre el territorio peruano y su margen costero.',
    bounds: { minLatitude: -20.5, maxLatitude: 0.5, minLongitude: -84.5, maxLongitude: -67.5 },
    approximate: true,
    mapCenter: [-9.2, -75.1],
    mapZoom: 5,
  },
  'peru-coast': {
    id: 'peru-coast',
    label: 'Costa del Perú',
    shortLabel: 'Costa',
    description: 'Zona costera aproximada, incluido el margen de subducción.',
    bounds: { minLatitude: -20.5, maxLatitude: -3, minLongitude: -84.5, maxLongitude: -74 },
    approximate: true,
    mapCenter: [-12, -78.5],
    mapZoom: 5,
  },
  'peru-highlands': {
    id: 'peru-highlands',
    label: 'Sierra del Perú',
    shortLabel: 'Sierra',
    description: 'Rectángulo aproximado de la región andina peruana.',
    bounds: { minLatitude: -18.5, maxLatitude: -4, minLongitude: -77.5, maxLongitude: -69 },
    approximate: true,
    mapCenter: [-11.5, -73.5],
    mapZoom: 5,
  },
  'peru-amazon': {
    id: 'peru-amazon',
    label: 'Selva del Perú',
    shortLabel: 'Selva',
    description: 'Rectángulo aproximado del territorio amazónico peruano.',
    bounds: { minLatitude: -14.5, maxLatitude: -0.5, minLongitude: -76, maxLongitude: -68 },
    approximate: true,
    mapCenter: [-7.5, -72],
    mapZoom: 5,
  },
  'pacific-ring': {
    id: 'pacific-ring',
    label: 'Cinturón de Fuego del Pacífico',
    shortLabel: 'Cinturón del Pacífico',
    description: 'Vista aproximada del Pacífico; no representa un límite tectónico exacto.',
    bounds: { minLatitude: -65, maxLatitude: 65, minLongitude: -180, maxLongitude: 180 },
    approximate: true,
    mapCenter: [5, -145],
    mapZoom: 2,
  },
  world: {
    id: 'world',
    label: 'Mundo',
    shortLabel: 'Mundo',
    description: 'Cobertura global sin restricción rectangular.',
    bounds: null,
    approximate: false,
    mapCenter: [12, -18],
    mapZoom: 2,
  },
};

export const REGION_PRESET_LIST = Object.values(REGION_PRESETS);

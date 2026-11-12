import type { FranjaIndex } from '@talaia/shared';

import { TRAVEL } from '@/features/explore/exploreModel';

/** Índex mínim per avisar. Per defecte, 75 (mockup 11): ja és «cel ras». */
export const MIN_INDEX = { min: 0, max: 100, step: 5, initial: 75 } as const;

/** Franges de l'índex v1 (ADR-0018): 0–39 tapat, 40–69 justet, 70–100 cel ras. */
export const INDEX_BANDS = [
  { until: 40, color: 'tap' },
  { until: 70, color: 'jus' },
  { until: 100, color: 'ras' },
] as const satisfies readonly { until: number; color: FranjaIndex }[];

export function bandOf(index: number): FranjaIndex {
  return INDEX_BANDS.find((band) => index < band.until)?.color ?? 'ras';
}

/**
 * L'API desa la distància en km en línia recta (`distanciaMaxKm`, 1–200). El temps es converteix
 * com ho fa `/recomanacions` (TG-100): 60 km/h amb un desviament de ×1,3. 4 h → 185 km.
 */
export function travelToKm(minutes: number): number {
  return Math.max(1, Math.round(minutes / 1.3));
}

/** Hora per defecte de l'avís a una hora concreta (mockup 11: «El mateix dia a les 18:00»). */
export const DEFAULT_NOTIFY_HOUR = 18;

/**
 * El contrari de `travelToKm`, per ensenyar una alerta desada en temps de cotxe, arrodonit als
 * passos de 15 min de la barra.
 */
export function kmToTravel(km: number): number {
  const step = TRAVEL.step;
  return Math.min(TRAVEL.max, Math.max(TRAVEL.min, Math.round((km * 1.3) / step) * step));
}

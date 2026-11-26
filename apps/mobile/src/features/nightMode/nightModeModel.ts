import type { Pla, PuntMapaFeature } from '@talaia/shared';

import type { ThemeName } from '@/core/theme/theme';
import { distanceKm } from '@/features/map/useMapSpot';

/** A menys d'aquesta distància del punt d'un pla en franja, el mode nit s'activa sol (HU45). */
export const NIGHT_RADIUS_KM = 0.5;

/** L'hora en què l'app canvia de nit (`exploreModel`): una tria a mà hi caduca (ADR-0032). */
export const NIGHT_ENDS_AT = 6;

/** Una tria a mà: el mode activat o desactivat fins a `until` (ms). */
export type ManualChoice = { on: boolean; until: number };

/** Les 06:00 següents, a l'hora del mòbil: a la 01:00 són d'aquí a cinc hores, no l'endemà. */
export function nextNightEnd(now: Date): Date {
  const end = new Date(now);
  end.setHours(NIGHT_ENDS_AT, 0, 0, 0);
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

/** La franja d'un pla: de l'inici a `dataHoraFi` o, si no en té, al final de la seva nit. */
export function planWindow(plan: Pla): { from: number; to: number } {
  const from = Date.parse(plan.dataHoraInici);
  const to = plan.dataHoraFi ? Date.parse(plan.dataHoraFi) : nextNightEnd(new Date(from)).getTime();
  return { from, to };
}

export const plansInWindow = (plans: readonly Pla[], now: number) =>
  plans.filter((plan) => {
    const { from, to } = planWindow(plan);
    return from <= now && now < to;
  });

/**
 * El primer pla en franja amb el punt a menys de `NIGHT_RADIUS_KM` de `position`. El punt surt del
 * catàleg del mapa (`GET /punts`): un punt retirat no hi és i no activa res.
 */
export function planNearby(
  plans: readonly Pla[],
  points: readonly PuntMapaFeature[],
  position: { lat: number; lon: number },
  now: number,
): Pla | undefined {
  const coords = new Map(
    points.map(({ properties, geometry: { coordinates } }) => [
      properties.id,
      { lon: coordinates[0], lat: coordinates[1] },
    ]),
  );
  return plansInWindow(plans, now).find((plan) => {
    const point = coords.get(plan.punt.id);
    return point !== undefined && distanceKm(position, point) <= NIGHT_RADIUS_KM;
  });
}

/** Una tria a mà vigent mana sobre l'automàtic; si ha caducat, torna a manar l'automàtic. */
export function nightTheme(choice: ManualChoice | null, nearby: boolean, now: number): ThemeName {
  if (choice && choice.until > now) return choice.on ? 'vermell' : 'normal';
  return nearby ? 'vermell' : 'normal';
}

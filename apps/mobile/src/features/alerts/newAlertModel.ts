import type { Alerta, AlertaCanvis, AlertaNova, FranjaIndex } from '@talaia/shared';

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
 *
 * És una còpia de `rutesEnLiniaRecta` (`services/api/src/recomanacions/rutes.ts`): si l'API canvia
 * l'estimació (Mobilicat, TG-135), cal canviar-la també aquí.
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

/**
 * El cos del `PATCH` en editar una alerta (HU18): només els camps que el formulari ha canviat.
 *
 * La distància es compara en minuts de la barra (`travel`), no en km: la barra arrodoneix l'alerta
 * desada a passos de 15 min, i tornar-la a km canviaria la distància sense que l'usuari la toqui.
 */
export function alertChanges(saved: Alerta, form: AlertaNova, travel: number): AlertaCanvis {
  const changes: AlertaCanvis = {};
  if (form.objectiu !== saved.objectiu) changes.objectiu = form.objectiu;
  if (form.origen.lat !== saved.origen.lat || form.origen.lon !== saved.origen.lon) {
    changes.origen = form.origen;
  }
  if (travel !== kmToTravel(saved.distanciaMaxKm)) changes.distanciaMaxKm = form.distanciaMaxKm;
  if (form.indexMinim !== saved.indexMinim) changes.indexMinim = form.indexMinim;
  // Si el tipus canvia, van tots dos camps: així l'alerta desada en queda només amb un.
  const type = notifyTypeOf(form);
  if (type !== notifyTypeOf(saved)) {
    changes.avisaEnArribar = form.avisaEnArribar;
    changes.horaAvis = form.horaAvis;
  } else if (type === 'hour' && form.horaAvis !== saved.horaAvis) {
    changes.horaAvis = form.horaAvis;
  }
  return changes;
}

/**
 * Els dos tipus d'avís (TG-268), exclusius a l'app: a una hora concreta (`horaAvis`) o quan algun
 * punt arriba a l'índex mínim (`avisaEnArribar`).
 */
export const NOTIFY_TYPES = ['hour', 'reach'] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

/**
 * El tipus d'una alerta. L'API encara admet totes dues opcions alhora (TG-146): una alerta
 * d'abans amb totes dues avisa en arribar-hi (ADR-0033), i així es mostra.
 */
export function notifyTypeOf(alert: Pick<Alerta, 'avisaEnArribar'>): NotifyType {
  return alert.avisaEnArribar ? 'reach' : 'hour';
}

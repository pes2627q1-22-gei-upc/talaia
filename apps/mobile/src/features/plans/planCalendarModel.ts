import type { Pla } from '@talaia/shared';

/** Durada predeterminada d'una sessió quan el pla no en defineix cap. */
const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export type PlanCalendarEvent = {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
  timeZone: string;
};

/** Sense final explícit, el calendari mostra una sessió de dues hores. */
export function planCalendarEvent(plan: Pla, title: string): PlanCalendarEvent {
  const startDate = Date.parse(plan.dataHoraInici);
  return {
    title,
    location: [plan.punt.nom, plan.punt.municipi].filter(Boolean).join(', '),
    startDate: plan.dataHoraInici,
    endDate: plan.dataHoraFi ?? new Date(startDate + DEFAULT_EVENT_DURATION_MS).toISOString(),
    notes: plan.notes ?? '',
    timeZone: 'Europe/Madrid',
  };
}

/** El que es llegeix d'un esdeveniment del calendari del mòbil per reconèixer-lo. */
export type DeviceEventFields = {
  startDate: string | Date;
  endDate: string | Date;
  location?: string | null;
};

const sameInstant = (a: string | Date, b: string) => new Date(a).getTime() === Date.parse(b);

/**
 * Si l'esdeveniment és el que l'app va crear per al pla (TG-162). L'id de `calendariEventId` només
 * val al mòbil que el va crear, i en un altre pot ser un esdeveniment de l'usuari: abans d'esborrar,
 * han de coincidir l'inici, el final i el municipi del punt. El títol no hi compta, perquè
 * depèn de l'idioma que tenia l'app en crear-lo. Si l'usuari l'ha mogut, no s'esborra.
 */
export function isPlanEvent(event: DeviceEventFields, plan: Pla): boolean {
  const expected = planCalendarEvent(plan, '');
  return (
    sameInstant(event.startDate, expected.startDate) &&
    sameInstant(event.endDate, expected.endDate) &&
    (event.location ?? '').includes(plan.punt.municipi)
  );
}

import { NIGHT_YEAR_MAX, NIGHT_YEAR_MIN } from '@talaia/shared';
import { z } from 'zod';

/**
 * Una «nit» va de les 12:00 locals d'un dia a les 12:00 de l'endemà. Les funcions pures són a
 * `@talaia/shared` (`nit.ts`), perquè el worker les fa servir per avaluar les alertes (TG-153,
 * ADR-0028); aquí s'hi afegeix l'esquema zod de `?nit=`.
 */
export {
  NIGHT_START_HOUR,
  NIGHT_YEAR_MAX,
  NIGHT_YEAR_MIN,
  TIME_ZONE,
  defaultNight,
  nightWindow,
  type NightWindow,
} from '@talaia/shared';

/** `YYYY-MM-DD`, un dia del calendari (`2026-02-30` es rebutja) entre el 2000 i el 2100. */
export const NightSchema = z.iso
  .date({ error: 'nit ha de ser un dia del calendari en format YYYY-MM-DD' })
  .refine((date) => isYearInRange(Number(date.slice(0, 4))), {
    error: `nit ha de ser entre el ${NIGHT_YEAR_MIN} i el ${NIGHT_YEAR_MAX}`,
  });

const isYearInRange = (year: number) => year >= NIGHT_YEAR_MIN && year <= NIGHT_YEAR_MAX;

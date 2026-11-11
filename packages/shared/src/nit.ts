/**
 * Una «nit» és la que comença el vespre d'un dia: de les 12:00 locals d'aquell dia a les 12:00
 * de l'endemà. Així la franja de després de mitjanit queda amb el dia del vespre, igual que
 * `ConsultaRecomanacions.data`. Les hores locals són les de Catalunya: tots els punts hi són.
 *
 * Codi pur sense dependències (ADR-0028): el fan servir l'API (TG-104, TG-100) i el worker, que
 * avalua les alertes una vegada per nit (TG-153). L'esquema zod de `?nit=` es queda a l'API.
 */
export const TIME_ZONE = 'Europe/Madrid';

/** Hora local on comença (i acaba) una nit. La fan servir també les recomanacions (TG-100). */
export const NIGHT_START_HOUR = 12;

/** Anys que accepta l'API: fora d'aquí `Intl` i `Date` no són de fiar (abans del 1901 el desplaçament de Madrid tenia segons; el 9999 desborda). */
export const NIGHT_YEAR_MIN = 2000;
export const NIGHT_YEAR_MAX = 2100;

/** Instants UTC `[from, to)` de les hores d'una nit. */
export type NightWindow = { from: Date; to: Date };

export function nightWindow(night: string, timeZone = TIME_ZONE): NightWindow {
  return { from: localNoon(night, timeZone), to: localNoon(nextDay(night), timeZone) };
}

/**
 * La nit en curs en un instant, que és també la que toca si no se'n demana cap: fins al migdia,
 * la que s'està acabant (de matinada es vol veure la nit en curs); a partir del migdia, la que ve.
 */
export function defaultNight(now: Date = new Date(), timeZone = TIME_ZONE): string {
  // Es compara amb el migdia real del dia, no amb «ara − 12 h»: els dies del canvi d'hora el
  // migdia local no és a 12 h de la mitjanit.
  const today = localDate(now, timeZone);
  return now < nightWindow(today, timeZone).from ? previousDay(today) : today;
}

/** Les 12:00 locals d'un dia, en UTC. El canvi d'hora és de matinada, així que el migdia no hi cau mai. */
function localNoon(date: string, timeZone: string): Date {
  const [y = NaN, m = NaN, d = NaN] = date.split('-').map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, NIGHT_START_HOUR));
  return new Date(noonUtc.getTime() - utcOffsetMs(noonUtc, timeZone));
}

/** Desplaçament de la zona respecte d'UTC en un instant (+2 h a l'estiu, +1 h a l'hivern). */
function utcOffsetMs(instant: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(instant)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (!match) throw new Error(`Desplaçament horari inesperat per a ${timeZone}: "${name}"`);
  const [, sign, hours = '0', minutes = '0'] = match;
  return (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutes)) * 60_000;
}

/** El dia (`YYYY-MM-DD`) que és en una zona horària en un instant. */
function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const nextDay = (date: string) => shiftDay(date, 1);
const previousDay = (date: string) => shiftDay(date, -1);

function shiftDay(date: string, days: number): string {
  const [y = NaN, m = NaN, d = NaN] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

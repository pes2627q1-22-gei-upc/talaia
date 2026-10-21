/**
 * La franja horària de «Què vols veure?» és en hores locals de Catalunya (`Europe/Madrid`) i
 * l'índex es desa per hores en UTC: aquí es passa de l'una a l'altra, amb el canvi d'hora.
 */
const ZONA = 'Europe/Madrid';
const DIA_MS = 86_400_000;

/**
 * Una nit va de les 12:00 locals del dia `data` a les 12:00 de l'endemà, com a `GET
 * /punts/{id}/index` (TG-104): una hora de 0 a 11 és la de l'endemà del vespre.
 */
export const INICI_NIT = 12;

/** Anys acceptats: fora d'aquí `Intl` i `Date` no són de fiar (el 9999 desborda), com a TG-104. */
export const ANY_MIN = 2000;
export const ANY_MAX = 2100;

const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Mil·lisegons que l'hora local de Catalunya va per davant de l'UTC en l'instant `ms`. */
function desfasament(ms: number): number {
  const p = Object.fromEntries(FORMAT.formatToParts(ms).map(({ type, value }) => [type, value]));
  const local = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
  return local - Math.floor(ms / 60_000) * 60_000;
}

/** `YYYY-MM-DD` → mil·lisegons de la mitjanit UTC d'aquell dia, o `NaN` si no és una data real. */
export function diaUtc(data: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return Number.NaN;
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  return new Date(ms).toISOString().slice(0, 10) === data ? ms : Number.NaN;
}

const endema = (data: string) => new Date(diaUtc(data) + DIA_MS).toISOString().slice(0, 10);

/**
 * L'instant UTC de l'hora local `hora` (0–23) del dia `data`. Una hora que no existeix (la que se
 * salta el canvi d'hora de primavera) passa a la següent; una de repetida (tardor), a la segona.
 */
export function horaLocalAUtc(data: string, hora: number): Date {
  const local = diaUtc(data) + hora * 3_600_000;
  const primer = local - desfasament(local);
  return new Date(local - desfasament(primer));
}

/**
 * La franja de la nit `data` en UTC, `[desDe, finsA)` (`ConsultaRecomanacions`). Una hora d'abans
 * de les 12 (`INICI_NIT`) és la de l'endemà: de 01 a 05 és la matinada després del vespre de
 * `data`. Si `finsA` < `desDe`, la franja acaba l'endemà de `desDe`.
 */
export function franjaUtc(
  data: string,
  desDe: number,
  finsA: number,
): { desDe: Date; finsA: Date } {
  const diaInici = desDe < INICI_NIT ? endema(data) : data;
  const diaFi = finsA <= desDe ? endema(diaInici) : diaInici;
  return { desDe: horaLocalAUtc(diaInici, desDe), finsA: horaLocalAUtc(diaFi, finsA) };
}

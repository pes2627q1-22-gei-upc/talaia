/**
 * La franja horària de «Què vols veure?» és en hores locals de Catalunya (`Europe/Madrid`) i
 * l'índex es desa per hores en UTC: aquí es passa de l'una a l'altra, amb el canvi d'hora.
 */
const ZONA = 'Europe/Madrid';
const DIA_MS = 86_400_000;

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
 * La franja d'una nit en UTC, `[desDe, finsA)`. Si `finsA` ≤ `desDe`, acaba l'endemà
 * (`ConsultaRecomanacions`).
 */
export function franjaUtc(
  data: string,
  desDe: number,
  finsA: number,
): { desDe: Date; finsA: Date } {
  const diaFi = finsA <= desDe ? new Date(diaUtc(data) + DIA_MS).toISOString().slice(0, 10) : data;
  return { desDe: horaLocalAUtc(data, desDe), finsA: horaLocalAUtc(diaFi, finsA) };
}

const ONE_DAY_MS = 86_400_000;
const madridOffset = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  timeZoneName: 'longOffset',
});

function offsetMillisecondsAt(instant: number): number {
  const label = madridOffset
    .formatToParts(new Date(instant))
    .find((part) => part.type === 'timeZoneName')?.value;
  if (label === 'GMT') return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(label ?? '');
  if (!match) throw new Error(`No es pot calcular l'offset de Europe/Madrid: ${label}`);
  return (
    (Number(match[2]) * 3_600 + Number(match[3]) * 60 + Number(match[4] ?? 0)) *
    1_000 *
    (match[1] === '+' ? 1 : -1)
  );
}

function midnightAtMadrid(utcMidnight: number): Date {
  let instant = utcMidnight;
  // La primera aproximació pot caure a l'altre costat d'un canvi d'hora.
  for (let i = 0; i < 3; i += 1) {
    const corrected = utcMidnight - offsetMillisecondsAt(instant);
    if (corrected === instant) return new Date(instant);
    instant = corrected;
  }
  return new Date(instant);
}

/** Converteix les 00:00 d'un dia civil català en un instant UTC, inclosos els canvis d'horari. */
export function iniciDiaCatala(dia: string): Date {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!parts) throw new Error(`Dia invàlid: ${dia}`);
  return midnightAtMadrid(Date.parse(dia));
}

/** Interval semiobert: `[des_de 00:00, dia després de fins_a 00:00)` a Catalunya. */
export function intervalCatala(desDe: string, finsA: string): { inici: Date; fi: Date } {
  return { inici: iniciDiaCatala(desDe), fi: midnightAtMadrid(Date.parse(finsA) + ONE_DAY_MS) };
}

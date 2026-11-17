import { defaultNight, localDate, nightWindow, TIME_ZONE, upcomingNight } from '../index/night';

const HORA_MS = 3_600_000;

/** El que cal d'un esdeveniment del calendari (`FilaEsdeveniment`) per calcular-ne la finestra. */
export type EsdevenimentPerFinestra = {
  inici: Date;
  fi: Date;
  maxim: Date | null;
  /** `{ inici, fi, maxim }` amb `dia`, `hora`, `minut` o `segon` (jsonb de la taula). */
  precisio: unknown;
};

/** La finestra d'un esdeveniment: la nit que li toca (`YYYY-MM-DD`) i les hores `[desDe, finsA)` en UTC. */
export type FinestraEsdeveniment = { data: string; desDe: Date; finsA: Date };

const iniciHora = (d: Date) => new Date(Math.floor(d.getTime() / HORA_MS) * HORA_MS);

/** Si l'inici o la fi només se saben al dia (pluges d'estels, fases de la Lluna, superllunes). */
function precisioDeDia(precisio: unknown): boolean {
  const p = (precisio ?? {}) as Record<string, unknown>;
  return p.inici === 'dia' || p.fi === 'dia';
}

/**
 * Les hores de `GET /recomanacions?esdevenimentId=` (TG-140). L'índex es guarda per hores en punt,
 * així que una hora compta si toca la finestra: de l'hora de l'inici fins a la fi (no inclosa).
 *
 * - **Hores conegudes** (eclipsis, conjuncions: inici i fi amb precisió d'hora o més fina):
 *   `[inici, fi]` tal qual, ampliada a les hores senceres que la toquen (05:30–06:30 → 05:00 i 06:00).
 * - **Precisió de dia** (pluges d'estels de setmanes, fases d'un dia sencer): el màxim de `[inici, fi]`
 *   seria una hora qualsevol dels dies de previsió, i la pregunta és «on el veig la nit bona». Per
 *   això:
 *   1. si la nit del màxim (sense màxim, la de l'inici) encara és la que toca o una de posterior
 *      (`upcomingNight`), aquella nit sencera, de 12:00 a 12:00 locals;
 *   2. si ja ha passat però l'esdeveniment encara dura (`fi >= now`), la nit que toca ara,
 *      retallada a `[inici, fi]`: les Leònides (6–30/11) encara es poden mirar el 20/11.
 *
 * Retorna `null` si l'esdeveniment ja s'ha acabat (`fi < now`): la ruta respon `franja_passada`.
 * Les hores ja passades d'una finestra en curs les retalla el servei, com a la resta de consultes.
 */
export function finestraEsdeveniment(
  esdeveniment: EsdevenimentPerFinestra,
  now: Date,
): FinestraEsdeveniment | null {
  const { inici, fi, maxim, precisio } = esdeveniment;
  if (fi < now) return null;

  if (!precisioDeDia(precisio)) {
    const desDe = iniciHora(inici);
    return { data: defaultNight(desDe), desDe, finsA: fi };
  }

  const nitQueToca = upcomingNight(now);
  // La nit del màxim és la que el conté (de 12:00 a 12:00). Sense màxim, l'inici d'un esdeveniment
  // de dia és la mitjanit (o la 01:00) del primer dia: la nit és la que comença el vespre d'aquell dia.
  const nitReferencia = maxim ? defaultNight(maxim) : localDate(inici, TIME_ZONE);
  if (nitReferencia >= nitQueToca) {
    const { from, to } = nightWindow(nitReferencia);
    return { data: nitReferencia, desDe: from, finsA: to };
  }

  const { from, to } = nightWindow(nitQueToca);
  const desDe = iniciHora(from > inici ? from : inici);
  const finsA = to < fi ? to : fi;
  if (desDe < finsA) return { data: nitQueToca, desDe, finsA };
  // La fi cau al matí, abans que comenci la nit que toca: el que queda, de l'hora en curs a la fi.
  return { data: defaultNight(now), desDe: iniciHora(now), finsA: fi };
}

import { defaultNight, nightWindow, type ObjectiuObservacio } from '@talaia/shared';

import { iniciHora, type ResumAlertes } from '../recalcul/recalcul';

/**
 * Una fila candidata (ADR-0033): una alerta, un punt publicat dins del seu radi i una hora de la
 * nit amb l'índex del punt. La consulta del repositori ja en descarta la majoria; la decisió és
 * de `pickNotifications`, que torna a comprovar-ho tot.
 */
export type AlertCandidate = {
  alertaId: string;
  perfilId: string;
  objectiu: ObjectiuObservacio;
  activa: boolean;
  indexMinim: number;
  distanciaMaxKm: number;
  puntId: string;
  puntNom: string;
  /** En línia recta, de l'origen de l'alerta al punt. */
  distanciaKm: number;
  /** Inici de l'hora, ISO 8601 en UTC. */
  hora: string;
  /**
   * L'índex del punt a aquella hora. A la v1 és el mateix per a tots els objectius (ADR-0018):
   * quan sigui per objectiu (ADR-0027), el repositori llegirà el de l'`objectiu` de l'alerta.
   */
  index: number;
};

/**
 * Una notificació d'una alerta per a una nit (una fila de `notificacions_alertes`): el millor
 * punt de la zona, amb l'hora i l'índex. És el que envia la TG-154: `puntId` obre la fitxa.
 */
export type NotificacioAlerta = Pick<
  AlertCandidate,
  'alertaId' | 'perfilId' | 'objectiu' | 'puntId' | 'puntNom' | 'distanciaKm' | 'hora' | 'index'
> & {
  /** La nit (`YYYY-MM-DD`, el dia del vespre): n'hi ha com a molt una per alerta i nit. */
  nit: string;
};

/** Les hores que compten en una avaluació: les que queden de la nit en curs, `[from, to)`. */
export type AlertsWindow = { nit: string; from: Date; to: Date };

/** Accés a la base de dades de l'avaluació (ADR-0013): Kysely a `repository.ts`, falsos als tests. */
export type AlertesRepository = {
  /**
   * Els candidats de les alertes actives que encara no tenen notificació per a `window.nit`:
   * punts publicats dins del radi, hores de la finestra i índex que arriba al mínim.
   */
  candidates(window: AlertsWindow): Promise<AlertCandidate[]>;
  /**
   * Desa les notificacions sense repetir cap alerta i nit (`on conflict do nothing`) i torna
   * només les noves: les que la TG-154 ha d'enviar.
   */
  saveNotifications(notificacions: NotificacioAlerta[]): Promise<NotificacioAlerta[]>;
};

export type AvaluacioAlertes = {
  nit: string;
  /** Les notificacions noves d'aquesta avaluació. */
  notificacions: NotificacioAlerta[];
};

/**
 * La nit en curs a `now` (de 12:00 a 12:00 locals, la mateixa de l'API: `nit.ts` de
 * `@talaia/shared`) i les hores que en queden, començant per l'hora en curs: una execució de les
 * 04:00 no pot anunciar la millor hora de les 23:00 (ADR-0028). Els dies del canvi d'hora la nit
 * dura 23 o 25 hores.
 */
export function alertsWindow(now: Date): AlertsWindow {
  const nit = defaultNight(now);
  const { from, to } = nightWindow(nit);
  const horaEnCurs = iniciHora(now);
  return { nit, from: horaEnCurs > from ? horaEnCurs : from, to };
}

/**
 * La decisió (ADR-0033), pura: per a cada alerta, el millor candidat que compleix totes les
 * condicions, o cap. Compleix si l'alerta és activa, el punt és dins del radi, l'hora és a la
 * finestra i l'índex arriba al mínim i no és 0 (amb un 0 no hi ha res a veure, sigui quin sigui
 * el mínim). El millor és el de més índex; si empaten, el punt més proper, i després l'hora més
 * d'hora. L'identificador del punt desempata la resta, perquè el resultat no depengui de l'ordre
 * de les files. Torna les notificacions ordenades per alerta.
 */
export function pickNotifications(
  candidates: readonly AlertCandidate[],
  window: AlertsWindow,
): NotificacioAlerta[] {
  const best = new Map<string, AlertCandidate>();
  for (const candidate of candidates) {
    if (!qualifies(candidate, window)) continue;
    const current = best.get(candidate.alertaId);
    if (!current || compareCandidates(candidate, current) < 0) {
      best.set(candidate.alertaId, candidate);
    }
  }
  return [...best.values()]
    .sort((a, b) => compareText(a.alertaId, b.alertaId))
    .map((c) => ({
      alertaId: c.alertaId,
      perfilId: c.perfilId,
      objectiu: c.objectiu,
      nit: window.nit,
      puntId: c.puntId,
      puntNom: c.puntNom,
      distanciaKm: c.distanciaKm,
      hora: c.hora,
      index: c.index,
    }));
}

function qualifies(c: AlertCandidate, { from, to }: AlertsWindow): boolean {
  const hora = Date.parse(c.hora);
  return (
    c.activa &&
    c.index > 0 &&
    c.index >= c.indexMinim &&
    c.distanciaKm <= c.distanciaMaxKm &&
    hora >= from.getTime() &&
    hora < to.getTime()
  );
}

/** Negatiu si `a` és millor que `b`. */
function compareCandidates(a: AlertCandidate, b: AlertCandidate): number {
  return (
    b.index - a.index ||
    a.distanciaKm - b.distanciaKm ||
    Date.parse(a.hora) - Date.parse(b.hora) ||
    compareText(a.puntId, b.puntId)
  );
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Una avaluació (TG-153): la finestra de la nit en curs, els candidats en una sola consulta, la
 * decisió i les notificacions desades. Una segona avaluació de la mateixa nit no en desa cap més
 * per a les alertes que ja en tenen.
 */
export async function evaluateAlerts(
  repository: AlertesRepository,
  now: Date,
): Promise<AvaluacioAlertes> {
  const window = alertsWindow(now);
  const candidates = await repository.candidates(window);
  const notificacions = await repository.saveNotifications(pickNotifications(candidates, window));
  return { nit: window.nit, notificacions };
}

/**
 * El pas d'alertes de l'execució horària: el port `alertes` de `recalculaIndex`, que el crida
 * després de desar l'índex. La TG-154 hi afegirà l'enviament de les notificacions noves que torna
 * `evaluateAlerts` (Expo Push), sense tocar ni l'avaluació ni el recàlcul.
 */
export function createAlertsStep(repository: AlertesRepository) {
  return async (now: Date): Promise<ResumAlertes> => {
    const { notificacions } = await evaluateAlerts(repository, now);
    return { notificacions: notificacions.length };
  };
}

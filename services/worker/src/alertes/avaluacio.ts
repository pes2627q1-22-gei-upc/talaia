import {
  defaultNight,
  localDate,
  localHour,
  nightWindow,
  type ObjectiuObservacio,
} from '@talaia/shared';

import { iniciHora, type ResumAlertes } from '../recalcul/recalcul';
import { sendPendingNotifications, type EnviamentRepository } from './enviament';
import type { ExpoPushClient } from './expoPush';

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
  /** Avisa tan bon punt algun punt arriba al mínim (TG-146). */
  avisaEnArribar: boolean;
  /** Avisa el mateix dia a aquesta hora local (0–23) si la previsió de la nit hi arriba; o `null`. */
  horaAvis: number | null;
  /** Un compte bloquejat no rep notificacions (ADR-0029). */
  perfilBloquejat: boolean;
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

/** Les hores que compten en una avaluació: les que queden d'una nit, `[from, to)`. */
export type AlertsWindow = { nit: string; from: Date; to: Date };

/**
 * Una finestra i quines alertes s'hi avaluen (TG-146): les que avisen en arribar-hi
 * (`enArribar`) i/o les que avisen a l'hora local `horaAvis`, la de l'execució.
 */
export type AlertsPlan = AlertsWindow & { enArribar: boolean; horaAvis: number | null };

/** Accés a la base de dades de l'avaluació (ADR-0013): Kysely a `repository.ts`, falsos als tests. */
export type AlertesRepository = {
  /**
   * Els candidats de les alertes actives del pla (les que avisen en arribar-hi si
   * `plan.enArribar`, i les de l'hora `plan.horaAvis`), de comptes no bloquejats i que encara no
   * tenen notificació per a `plan.nit`: punts publicats dins del radi, hores de la finestra i
   * índex que arriba al mínim.
   */
  candidates(plan: AlertsPlan): Promise<AlertCandidate[]>;
  /**
   * Desa les notificacions sense repetir cap alerta i nit (`on conflict do nothing`) i torna
   * només les noves: les que la TG-154 ha d'enviar. Pot rebre dues nits diferents de la mateixa
   * alerta (vegeu `alertsPlans`).
   */
  saveNotifications(notificacions: NotificacioAlerta[]): Promise<NotificacioAlerta[]>;
};

export type AvaluacioAlertes = {
  /** Les finestres que s'han avaluat. */
  plans: AlertsPlan[];
  /** Les notificacions noves d'aquesta avaluació. Cadascuna porta la seva `nit`. */
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
 * Què s'avalua en una execució (TG-146, ADR-0033), segons quan avisa cada alerta:
 * - **En arribar-hi** (`avisa_en_arribar`): les hores que queden de la nit en curs
 *   (`alertsWindow`), a cada execució.
 * - **A una hora** (`hora_avis`): les alertes de l'hora local de l'execució, amb la nit del dia
 *   d'avui (la del vespre). A partir del migdia és la nit en curs i va en el mateix pla; abans
 *   (una alerta de les 9), la nit en curs encara és la d'ahir i la d'avui va en un pla a part,
 *   sencera.
 */
export function alertsPlans(now: Date): AlertsPlan[] {
  const enCurs = alertsWindow(now);
  const horaAvis = localHour(now);
  const avui = localDate(now);
  if (avui === enCurs.nit) return [{ ...enCurs, enArribar: true, horaAvis }];
  return [
    { ...enCurs, enArribar: true, horaAvis: null },
    { nit: avui, ...nightWindow(avui), enArribar: false, horaAvis },
  ];
}

/**
 * La decisió (ADR-0033), pura: per a cada alerta, el millor candidat que compleix totes les
 * condicions, o cap. Compleix si l'alerta és activa i del pla (avisa en arribar-hi, o a l'hora
 * del pla), el compte no està bloquejat, el punt és dins del radi, l'hora és a la finestra i
 * l'índex arriba al mínim i no és 0 (amb un 0 no hi ha res a veure, sigui quin sigui el mínim). El millor és el de més índex; si empaten, el punt més proper, i després l'hora més
 * d'hora. L'identificador del punt desempata la resta, perquè el resultat no depengui de l'ordre
 * de les files. Torna les notificacions ordenades per alerta.
 */
export function pickNotifications(
  candidates: readonly AlertCandidate[],
  plan: AlertsPlan,
): NotificacioAlerta[] {
  const best = new Map<string, AlertCandidate>();
  for (const candidate of candidates) {
    if (!qualifies(candidate, plan)) continue;
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
      nit: plan.nit,
      puntId: c.puntId,
      puntNom: c.puntNom,
      distanciaKm: c.distanciaKm,
      hora: c.hora,
      index: c.index,
    }));
}

function qualifies(c: AlertCandidate, { from, to, enArribar, horaAvis }: AlertsPlan): boolean {
  const hora = Date.parse(c.hora);
  const delPla = (enArribar && c.avisaEnArribar) || (horaAvis !== null && c.horaAvis === horaAvis);
  return (
    c.activa &&
    delPla &&
    !c.perfilBloquejat &&
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
 * Una avaluació (TG-153): els plans de l'execució (un, o dos abans del migdia), els candidats de
 * cada un en una sola consulta, la decisió i les notificacions desades totes alhora. Una segona
 * avaluació de la mateixa nit no en desa cap més per a les alertes que ja en tenen.
 */
export async function evaluateAlerts(
  repository: AlertesRepository,
  now: Date,
): Promise<AvaluacioAlertes> {
  const plans = alertsPlans(now);
  const decidides: NotificacioAlerta[] = [];
  for (const plan of plans) {
    decidides.push(...pickNotifications(await repository.candidates(plan), plan));
  }
  const notificacions = await repository.saveNotifications(decidides);
  return { plans, notificacions };
}

/**
 * El pas d'alertes de l'execució horària: el port `alertes` de `recalculaIndex`, que el crida
 * després de desar l'índex. Avalua les alertes i, amb `enviament` (TG-154), envia per Expo Push
 * les notificacions pendents: les noves i les que no s'han pogut enviar abans. Un error de
 * l'enviament no amaga les notificacions desades: va a `errorEnviament`.
 */
export function createAlertsStep(
  repository: AlertesRepository,
  enviament?: { repository: EnviamentRepository; push: ExpoPushClient },
) {
  return async (now: Date): Promise<ResumAlertes> => {
    const { notificacions } = await evaluateAlerts(repository, now);
    if (!enviament) return { notificacions: notificacions.length };
    let errors: string[];
    try {
      const resum = await sendPendingNotifications(enviament.repository, enviament.push, now);
      console.log(
        `[worker] alertes: ${notificacions.length} noves, ${resum.enviades} enviades, ` +
          `${resum.tokensEsborrats} tokens esborrats`,
      );
      errors = resum.errors;
    } catch (error) {
      errors = [error instanceof Error ? error.message : String(error)];
    }
    if (errors.length === 0) return { notificacions: notificacions.length };
    console.error("[worker] l'enviament de les alertes ha fallat", errors);
    return { notificacions: notificacions.length, errorEnviament: errors.join('; ') };
  };
}

import { localHour } from '@talaia/shared';

import { iniciHora } from '../recalcul/recalcul';
import type { NotificacioAlerta } from './avaluacio';
import {
  MISSATGES_PER_PETICIO,
  type ExpoPushClient,
  type MissatgePush,
  type TicketPush,
} from './expoPush';

/**
 * Una fila de `notificacions_alertes` que encara no s'ha enviat (`enviada_el` a `null`), amb el que
 * cal per al text i per trobar els tokens del perfil.
 */
export type NotificacioPendent = Pick<
  NotificacioAlerta,
  'alertaId' | 'perfilId' | 'nit' | 'puntId' | 'puntNom' | 'hora' | 'index'
>;

/** Accés a la base de dades de l'enviament (ADR-0013): Kysely a `enviamentRepository.ts`. */
export type EnviamentRepository = {
  /**
   * Les notificacions sense enviar que encara tenen sentit: la millor hora és `desDe` o més tard,
   * l'alerta continua activa, el compte no està bloquejat i el punt continua publicat.
   */
  pending(desDe: Date): Promise<NotificacioPendent[]>;
  /** Els tokens de `dispositius_push` d'aquests perfils. */
  tokens(perfilIds: string[]): Promise<{ perfilId: string; token: string }[]>;
  /** Omple `enviada_el` i `ticket_ids` de la fila `(alerta_id, nit)`. */
  markSent(
    clau: Pick<NotificacioPendent, 'alertaId' | 'nit'>,
    ticketIds: string[],
    enviadaEl: Date,
  ): Promise<void>;
  /** Esborra els tokens que Expo diu que ja no existeixen. */
  deleteTokens(tokens: string[]): Promise<void>;
};

export type ResumEnviament = {
  /** Notificacions que Expo ha acceptat per a algun dispositiu (marcades com a enviades). */
  enviades: number;
  /** Tokens esborrats per `DeviceNotRegistered`. */
  tokensEsborrats: number;
  /** Errors d'Expo (sense repetir), si n'hi ha hagut. Les notificacions afectades es reintenten. */
  errors: string[];
};

/** El text de la notificació, de moment en català (ADR-0028). */
export function pushMessage(n: NotificacioPendent, token: string): MissatgePush {
  const hora = String(localHour(new Date(n.hora))).padStart(2, '0');
  return {
    to: token,
    title: `Bona nit per observar a ${n.puntNom}`,
    body: `Índex de visibilitat ${n.index} a les ${hora}:00. Toca per veure el punt.`,
    data: { puntId: n.puntId },
    sound: 'default',
    channelId: 'alertes',
    priority: 'high',
  };
}

/**
 * Envia les notificacions pendents (TG-154): les noves d'aquesta execució i les que no s'han
 * pogut enviar abans, mentre la seva millor hora no hagi passat. Un missatge per token del perfil.
 * - Una notificació és **enviada** quan Expo n'accepta almenys un missatge: llavors s'omplen
 *   `enviada_el` i `ticket_ids`, i ja no es torna a enviar. La de la nit següent és una altra fila
 *   (clau `(alerta_id, nit)`), i l'avaluació no en crea cap més per a la mateixa nit.
 * - Si falla tota la petició o Expo torna un error (`MessageRateExceeded`…), la fila queda amb
 *   `enviada_el` a `null` i l'execució següent la reintenta.
 * - Un perfil sense cap token (sense permís, o a Expo Go) no rep res: la fila queda pendent i, si
 *   activa les notificacions abans de la millor hora, la rep llavors.
 * - `DeviceNotRegistered` (l'app s'ha desinstal·lat): s'esborra el token.
 */
export async function sendPendingNotifications(
  repository: EnviamentRepository,
  push: ExpoPushClient,
  now: Date,
): Promise<ResumEnviament> {
  const resum: ResumEnviament = { enviades: 0, tokensEsborrats: 0, errors: [] };
  const pendents = await repository.pending(iniciHora(now));
  if (pendents.length === 0) return resum;

  const tokensPerPerfil = new Map<string, string[]>();
  for (const { perfilId, token } of await repository.tokens([
    ...new Set(pendents.map((n) => n.perfilId)),
  ])) {
    tokensPerPerfil.set(perfilId, [...(tokensPerPerfil.get(perfilId) ?? []), token]);
  }
  const enviaments = pendents.flatMap((n) =>
    (tokensPerPerfil.get(n.perfilId) ?? []).map((token) => ({ n, token })),
  );

  const tickets = new Map<NotificacioPendent, string[]>();
  const invalids = new Set<string>();
  const errors = new Set<string>();
  for (let i = 0; i < enviaments.length; i += MISSATGES_PER_PETICIO) {
    const lot = enviaments.slice(i, i + MISSATGES_PER_PETICIO);
    let resultats: TicketPush[];
    try {
      resultats = await push.send(lot.map(({ n, token }) => pushMessage(n, token)));
    } catch (error) {
      errors.add(error instanceof Error ? error.message : String(error));
      continue;
    }
    resultats.forEach((ticket, j) => {
      const { n, token } = lot[j]!;
      if (ticket.status === 'ok') tickets.set(n, [...(tickets.get(n) ?? []), ticket.id]);
      else if (ticket.error === 'DeviceNotRegistered') invalids.add(token);
      else errors.add(`${ticket.error ?? 'error'}: ${ticket.message}`);
    });
  }

  if (invalids.size > 0) {
    await repository.deleteTokens([...invalids]);
    resum.tokensEsborrats = invalids.size;
  }
  for (const [n, ticketIds] of tickets) {
    await repository.markSent(n, ticketIds, now);
    resum.enviades++;
  }
  resum.errors = [...errors];
  return resum;
}

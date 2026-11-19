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
 * Una fila de `notificacions_alertes` reservada per enviar, amb el que cal per al text (l'índex és
 * el de la previsió actual, no el de l'avaluació) i per trobar els tokens del perfil.
 */
export type NotificacioPendent = Pick<
  NotificacioAlerta,
  'alertaId' | 'perfilId' | 'nit' | 'puntId' | 'puntNom' | 'hora' | 'index'
>;

type ClauNotificacio = Pick<NotificacioPendent, 'alertaId' | 'nit'>;

/** Accés a la base de dades de l'enviament (ADR-0013): Kysely a `enviamentRepository.ts`. */
export type EnviamentRepository = {
  /**
   * **Reserva** les notificacions que s'han d'enviar (posa `enviada_el = reservadaEl` on era
   * `null`, en un sol `update … returning`) i les torna. Només les que encara tenen sentit: la
   * millor hora és `desDe` o més tard, l'alerta continua activa, el compte no està bloquejat, el
   * punt continua publicat i l'índex **actual** d'aquella hora encara arriba al mínim. Dos
   * processos alhora no poden reservar la mateixa fila.
   */
  claim(desDe: Date, reservadaEl: Date): Promise<NotificacioPendent[]>;
  /** Els tokens de `dispositius_push` d'aquests perfils. */
  tokens(perfilIds: string[]): Promise<{ perfilId: string; token: string }[]>;
  /** Desa els tickets d'Expo d'una notificació enviada. */
  saveTickets(clau: ClauNotificacio, ticketIds: string[]): Promise<void>;
  /** Desfà la reserva (`enviada_el` torna a `null`) perquè l'execució següent la reintenti. */
  release(clau: ClauNotificacio, reservadaEl: Date): Promise<void>;
  /** Esborra els tokens que Expo diu que ja no existeixen. */
  deleteTokens(tokens: string[]): Promise<void>;
};

export type ResumEnviament = {
  /** Notificacions que Expo ha acceptat per a algun dispositiu. */
  enviades: number;
  /** Tokens esborrats per `DeviceNotRegistered`. */
  tokensEsborrats: number;
  /** Errors (sense repetir), si n'hi ha hagut. */
  errors: string[];
};

/** El text de la notificació, de moment en català (ADR-0028). */
export function pushMessage(n: NotificacioPendent, token: string): MissatgePush {
  const hora = localHour(new Date(n.hora));
  // «a la 01:00», però «a les 23:00».
  const aLes = `${hora === 1 ? 'a la' : 'a les'} ${String(hora).padStart(2, '0')}:00`;
  return {
    to: token,
    title: `Bona nit per observar a ${n.puntNom}`,
    body: `Índex de visibilitat ${n.index} ${aLes}. Toca per veure el punt.`,
    data: { puntId: n.puntId },
    sound: 'default',
    channelId: 'alertes',
    priority: 'high',
  };
}

const missatge = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Envia les notificacions pendents (TG-154): les noves d'aquesta execució i les que no s'han
 * pogut enviar abans, mentre la seva millor hora no hagi passat. Un missatge per token del perfil.
 * - **Primer es reserven** (`claim`): una execució repetida o solapada (un altre worker contra la
 *   mateixa BD) no les pot tornar a agafar, i un error de la BD després d'enviar no fa que
 *   s'enviïn dues vegades (ADR-0028).
 * - Si Expo n'accepta almenys un missatge, la notificació és **enviada**: es desen els tickets.
 * - Si no (la petició falla, `MessageRateExceeded`…, o el perfil encara no té cap token), es
 *   desfà la reserva i l'execució següent la reintenta. Si desfer-la falla, aquella nit es perd:
 *   és preferible a enviar-la dues vegades.
 * - `DeviceNotRegistered` (l'app s'ha desinstal·lat): s'esborra el token.
 */
export async function sendPendingNotifications(
  repository: EnviamentRepository,
  push: ExpoPushClient,
  now: Date,
): Promise<ResumEnviament> {
  const resum: ResumEnviament = { enviades: 0, tokensEsborrats: 0, errors: [] };
  const reservades = await repository.claim(iniciHora(now), now);
  if (reservades.length === 0) return resum;

  const tickets = new Map<NotificacioPendent, string[]>();
  const invalids = new Set<string>();
  const errors = new Set<string>();
  try {
    const tokensPerPerfil = new Map<string, string[]>();
    const perfils = [...new Set(reservades.map((n) => n.perfilId))];
    for (const { perfilId, token } of await repository.tokens(perfils)) {
      tokensPerPerfil.set(perfilId, [...(tokensPerPerfil.get(perfilId) ?? []), token]);
    }
    const enviaments = reservades.flatMap((n) =>
      (tokensPerPerfil.get(n.perfilId) ?? []).map((token) => ({ n, token })),
    );
    for (let i = 0; i < enviaments.length; i += MISSATGES_PER_PETICIO) {
      const lot = enviaments.slice(i, i + MISSATGES_PER_PETICIO);
      let resultats: TicketPush[];
      try {
        resultats = await push.send(lot.map(({ n, token }) => pushMessage(n, token)));
      } catch (error) {
        errors.add(missatge(error));
        continue;
      }
      resultats.forEach((ticket, j) => {
        const { n, token } = lot[j]!;
        if (ticket.status === 'ok') tickets.set(n, [...(tickets.get(n) ?? []), ticket.id]);
        else if (ticket.error === 'DeviceNotRegistered') invalids.add(token);
        else errors.add(`${ticket.error ?? 'error'}: ${ticket.message}`);
      });
    }
  } catch (error) {
    // Els tokens no s'han pogut llegir: no s'ha enviat res, i totes es reintenten.
    errors.add(missatge(error));
  }

  // Cada notificació per separat: un error en una no deixa les altres reservades.
  for (const n of reservades) {
    const ticketIds = tickets.get(n);
    try {
      if (ticketIds) await repository.saveTickets(n, ticketIds);
      else await repository.release(n, now);
    } catch (error) {
      errors.add(missatge(error));
    }
    if (ticketIds) resum.enviades++;
  }
  if (invalids.size > 0) {
    try {
      await repository.deleteTokens([...invalids]);
      resum.tokensEsborrats = invalids.size;
    } catch (error) {
      errors.add(missatge(error));
    }
  }
  resum.errors = [...errors];
  return resum;
}

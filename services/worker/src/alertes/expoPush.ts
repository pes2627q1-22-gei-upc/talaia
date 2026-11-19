import { z } from 'zod';

/**
 * Client de l'Expo Push Service (TG-154, ADR-0028): un `POST` amb `fetch`, sense `expo-server-sdk`.
 * Amb unes poques alertes per hora no cal ni la concurrència ni els reintents de la llibreria:
 * qui reintenta és l'execució següent. Referència: https://docs.expo.dev/push-notifications/sending-notifications/
 */
export const URL_EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/** Expo n'accepta com a molt 100 per petició. */
export const MISSATGES_PER_PETICIO = 100;

export const TIMEOUT_MS_PER_DEFECTE = 30_000;

/** Un missatge per a un token. `data.puntId` és el que obre la fitxa en tocar-la (ADR-0028). */
export type MissatgePush = {
  to: string;
  title: string;
  body: string;
  data: { puntId: string };
  sound: 'default';
  /** El canal d'Android que crea l'app (`ALERTS_CHANNEL_ID`). */
  channelId: 'alertes';
  priority: 'high';
};

/**
 * El resultat d'un missatge, en el mateix ordre. `ok` només vol dir que Expo l'ha rebut. `error`
 * és el codi d'Expo (`DeviceNotRegistered`, `MessageRateExceeded`…), si n'hi ha.
 */
export type TicketPush =
  { status: 'ok'; id: string } | { status: 'error'; message: string; error?: string };

export type ExpoPushClient = {
  /** Envia com a molt `MISSATGES_PER_PETICIO` missatges en una petició. */
  send(missatges: MissatgePush[]): Promise<TicketPush[]>;
};

export type ExpoPushClientOptions = {
  /** `EXPO_ACCESS_TOKEN`: cal si el projecte té activada la seguretat reforçada de push. */
  accessToken?: string;
  url?: string;
  timeoutMs?: number;
  /** Injectable als tests. Per defecte, el `fetch` global de Node. */
  fetch?: typeof fetch;
};

/** Error de tota una petició: xarxa o timeout (sense `status`), HTTP o cos inesperat. */
export class ExpoPushError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ExpoPushError';
  }
}

const RespostaSchema = z.object({
  data: z.array(
    z.union([
      z.object({ status: z.literal('ok'), id: z.string() }),
      z.object({
        status: z.literal('error'),
        message: z.string(),
        details: z.object({ error: z.string().optional() }).optional(),
      }),
    ]),
  ),
});

const ErrorsSchema = z.object({ errors: z.array(z.object({ message: z.string() })).min(1) });

export function createExpoPushClient(options: ExpoPushClientOptions = {}): ExpoPushClient {
  const {
    accessToken,
    url = URL_EXPO_PUSH,
    timeoutMs = TIMEOUT_MS_PER_DEFECTE,
    fetch: doFetch = fetch,
  } = options;

  return {
    async send(missatges) {
      if (missatges.length === 0) return [];
      if (missatges.length > MISSATGES_PER_PETICIO) {
        throw new RangeError(`Com a molt ${MISSATGES_PER_PETICIO} missatges per petició`);
      }
      const resposta = await doFetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(missatges),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((error: unknown) => {
        const motiu = error instanceof Error ? error.message : String(error);
        throw new ExpoPushError(`No s'ha pogut contactar amb Expo Push: ${motiu}`);
      });
      const cos: unknown = await resposta.json().catch(() => undefined);
      if (!resposta.ok) {
        const errors = ErrorsSchema.safeParse(cos);
        const motiu = errors.success ? errors.data.errors[0]!.message : resposta.statusText;
        throw new ExpoPushError(
          `Expo Push ha respost ${resposta.status}: ${motiu}`,
          resposta.status,
        );
      }
      const parsed = RespostaSchema.safeParse(cos);
      if (!parsed.success || parsed.data.data.length !== missatges.length) {
        throw new ExpoPushError("Resposta inesperada d'Expo Push", resposta.status);
      }
      return parsed.data.data.map((ticket) =>
        ticket.status === 'ok'
          ? { status: 'ok', id: ticket.id }
          : { status: 'error', message: ticket.message, error: ticket.details?.error },
      );
    },
  };
}

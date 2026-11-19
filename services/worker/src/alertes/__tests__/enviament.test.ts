import { createAlertsStep, type AlertesRepository } from '../avaluacio';
import {
  pushMessage,
  sendPendingNotifications,
  type EnviamentRepository,
  type NotificacioPendent,
} from '../enviament';
import type { ExpoPushClient, MissatgePush, TicketPush } from '../expoPush';

// Dimecres 11/11/2026 a les 20:05 de Catalunya (UTC+1). L'hora en curs és la de les 19:00Z.
const ARA = new Date('2026-11-11T19:05:00.000Z');

const pendent = (canvis: Partial<NotificacioPendent> = {}): NotificacioPendent => ({
  alertaId: 'alerta-1',
  perfilId: 'perfil-1',
  nit: '2026-11-11',
  puntId: 'montsec',
  puntNom: 'Montsec',
  hora: '2026-11-11T22:00:00.000Z',
  index: 75,
  ...canvis,
});

/**
 * La taula en memòria: `claim` reserva les files sense `enviada_el` amb hora ≥ `desDe`, com fa
 * l'`update` de Kysely (els altres filtres es proven amb l'SQL). `enviades` són les que tenen
 * tickets desats.
 */
function repositoriEnMemoria(
  files: NotificacioPendent[],
  dispositius: { perfilId: string; token: string }[],
) {
  const reserves = new Map<string, Date>();
  const enviades = new Map<string, { ticketIds: string[]; enviadaEl: Date }>();
  const clau = (n: Pick<NotificacioPendent, 'alertaId' | 'nit'>) => `${n.alertaId}|${n.nit}`;
  let tokens = [...dispositius];
  const repository: EnviamentRepository = {
    claim: jest.fn(async (desDe: Date, reservadaEl: Date) => {
      const lliures = files.filter(
        (n) => !reserves.has(clau(n)) && Date.parse(n.hora) >= desDe.getTime(),
      );
      for (const n of lliures) reserves.set(clau(n), reservadaEl);
      return lliures;
    }),
    tokens: jest.fn(async (perfilIds: string[]) =>
      tokens.filter((t) => perfilIds.includes(t.perfilId)),
    ),
    saveTickets: jest.fn(async (n, ticketIds) => {
      enviades.set(clau(n), { ticketIds, enviadaEl: reserves.get(clau(n))! });
    }),
    release: jest.fn(async (n, reservadaEl) => {
      if (reserves.get(clau(n))?.getTime() === reservadaEl.getTime()) reserves.delete(clau(n));
    }),
    deleteTokens: jest.fn(async (esborrar: string[]) => {
      tokens = tokens.filter((t) => !esborrar.includes(t.token));
    }),
  };
  return { repository, enviades, reserves, tokens: () => tokens };
}

/** Expo fals: respon amb `resposta(missatge)` o llança l'error de la petició. */
function expoFals(
  resposta: (m: MissatgePush) => TicketPush = () => ({ status: 'ok', id: 'ticket' }),
) {
  let n = 0;
  const push: ExpoPushClient = {
    send: jest.fn(async (missatges: MissatgePush[]) =>
      missatges.map((m) => {
        const ticket = resposta(m);
        return ticket.status === 'ok' ? { ...ticket, id: `${ticket.id}-${++n}` } : ticket;
      }),
    ),
  };
  return push;
}

describe('pushMessage', () => {
  it("porta el punt, l'índex i l'hora local al text, i el puntId al data", () => {
    expect(pushMessage(pendent(), 'ExponentPushToken[a]')).toEqual({
      to: 'ExponentPushToken[a]',
      title: 'Bona nit per observar a Montsec',
      // 22:00Z és a les 23:00 a Catalunya a l'hivern.
      body: 'Índex de visibilitat 75 a les 23:00. Toca per veure el punt.',
      data: { puntId: 'montsec' },
      sound: 'default',
      channelId: 'alertes',
      priority: 'high',
    });
  });

  it('a la 01:00, però a les 00:00 i a les 02:00', () => {
    const body = (hora: string) => pushMessage(pendent({ hora }), 't').body;
    expect(body('2026-11-12T00:00:00.000Z')).toContain('75 a la 01:00.');
    expect(body('2026-11-11T23:00:00.000Z')).toContain('75 a les 00:00.');
    expect(body('2026-11-12T01:00:00.000Z')).toContain('75 a les 02:00.');
  });

  it('les hores de matinada porten el zero davant', () => {
    expect(pushMessage(pendent({ hora: '2026-11-12T02:00:00.000Z' }), 't').body).toContain(
      'a les 03:00',
    );
  });
});

describe('sendPendingNotifications', () => {
  it('envia un missatge per token del perfil i marca la notificació com a enviada amb els tickets', async () => {
    const { repository, enviades } = repositoriEnMemoria(
      [pendent()],
      [
        { perfilId: 'perfil-1', token: 'ExponentPushToken[mobil]' },
        { perfilId: 'perfil-1', token: 'ExponentPushToken[tauleta]' },
        { perfilId: 'perfil-2', token: 'ExponentPushToken[altre]' },
      ],
    );
    const push = expoFals();

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 1,
      tokensEsborrats: 0,
      errors: [],
    });
    expect(repository.claim).toHaveBeenCalledWith(new Date('2026-11-11T19:00:00.000Z'), ARA);
    expect(repository.tokens).toHaveBeenCalledWith(['perfil-1']);
    expect(push.send).toHaveBeenCalledWith([
      pushMessage(pendent(), 'ExponentPushToken[mobil]'),
      pushMessage(pendent(), 'ExponentPushToken[tauleta]'),
    ]);
    expect(enviades.get('alerta-1|2026-11-11')).toEqual({
      ticketIds: ['ticket-1', 'ticket-2'],
      enviadaEl: ARA,
    });
  });

  it('no repeteix: una notificació enviada no es torna a enviar a la següent execució', async () => {
    const { repository } = repositoriEnMemoria([pendent()], [{ perfilId: 'perfil-1', token: 'a' }]);
    const push = expoFals();

    await sendPendingNotifications(repository, push, ARA);
    await expect(
      sendPendingNotifications(repository, push, new Date('2026-11-11T20:05:00.000Z')),
    ).resolves.toEqual({ enviades: 0, tokensEsborrats: 0, errors: [] });
    expect(push.send).toHaveBeenCalledTimes(1);
  });

  it('sense pendents no demana tokens ni crida Expo', async () => {
    const { repository } = repositoriEnMemoria([], []);
    const push = expoFals();
    await sendPendingNotifications(repository, push, ARA);
    expect(repository.tokens).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
  });

  it("un perfil sense tokens no rep res, i la notificació queda pendent fins que n'hi ha", async () => {
    const files = [pendent()];
    const { repository, enviades, reserves } = repositoriEnMemoria(files, []);
    const push = expoFals();

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toMatchObject({
      enviades: 0,
    });
    expect(push.send).not.toHaveBeenCalled();
    expect(enviades.size).toBe(0);
    // La reserva es desfà: torna a ser pendent.
    expect(reserves.size).toBe(0);

    // L'usuari activa les notificacions: a l'execució següent, abans de la millor hora, la rep.
    const ambToken = repositoriEnMemoria(files, [{ perfilId: 'perfil-1', token: 'a' }]);
    await expect(
      sendPendingNotifications(ambToken.repository, push, new Date('2026-11-11T21:05:00.000Z')),
    ).resolves.toMatchObject({ enviades: 1 });
  });

  it("si la petició falla, la notificació queda pendent i l'execució següent la reintenta", async () => {
    const { repository, enviades } = repositoriEnMemoria(
      [pendent()],
      [{ perfilId: 'perfil-1', token: 'a' }],
    );
    const push = expoFals();
    jest
      .mocked(push.send)
      .mockRejectedValueOnce(new Error('Expo Push ha respost 503: Service Unavailable'));

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 0,
      tokensEsborrats: 0,
      errors: ['Expo Push ha respost 503: Service Unavailable'],
    });
    expect(enviades.size).toBe(0);

    await expect(
      sendPendingNotifications(repository, push, new Date('2026-11-11T20:05:00.000Z')),
    ).resolves.toMatchObject({ enviades: 1, errors: [] });
    expect(enviades.get('alerta-1|2026-11-11')?.enviadaEl).toEqual(
      new Date('2026-11-11T20:05:00.000Z'),
    );
  });

  it('un error d’Expo en un ticket deixa la notificació pendent i queda als errors, sense repetir-lo', async () => {
    const { repository, enviades } = repositoriEnMemoria(
      [pendent({ alertaId: 'alerta-1' }), pendent({ alertaId: 'alerta-2' })],
      [{ perfilId: 'perfil-1', token: 'a' }],
    );
    const push = expoFals(() => ({
      status: 'error',
      message: 'Too many messages',
      error: 'MessageRateExceeded',
    }));

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 0,
      tokensEsborrats: 0,
      errors: ['MessageRateExceeded: Too many messages'],
    });
    expect(enviades.size).toBe(0);
  });

  it("un ticket d'error sense codi també queda als errors", async () => {
    const { repository } = repositoriEnMemoria([pendent()], [{ perfilId: 'perfil-1', token: 'a' }]);
    const push = expoFals(() => ({ status: 'error', message: 'Unknown' }));
    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toMatchObject({
      errors: ['error: Unknown'],
    });
  });

  it('esborra els tokens DeviceNotRegistered; si un altre dispositiu la rep, és enviada', async () => {
    const { repository, enviades, tokens } = repositoriEnMemoria(
      [pendent()],
      [
        { perfilId: 'perfil-1', token: 'ExponentPushToken[desinstal·lada]' },
        { perfilId: 'perfil-1', token: 'ExponentPushToken[mobil]' },
      ],
    );
    const push = expoFals((m) =>
      m.to === 'ExponentPushToken[desinstal·lada]'
        ? { status: 'error', message: 'not registered', error: 'DeviceNotRegistered' }
        : { status: 'ok', id: 'ticket' },
    );

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 1,
      tokensEsborrats: 1,
      errors: [],
    });
    expect(repository.deleteTokens).toHaveBeenCalledWith(['ExponentPushToken[desinstal·lada]']);
    expect(tokens()).toEqual([{ perfilId: 'perfil-1', token: 'ExponentPushToken[mobil]' }]);
    expect(enviades.get('alerta-1|2026-11-11')?.ticketIds).toEqual(['ticket-1']);
  });

  it('no reintenta les notificacions de les quals la millor hora ja ha passat', async () => {
    const { repository } = repositoriEnMemoria([pendent()], [{ perfilId: 'perfil-1', token: 'a' }]);
    const push = expoFals();
    // A les 00:05 locals (23:05Z), la millor hora (les 23:00 locals, 22:00Z) ja ha passat.
    await expect(
      sendPendingNotifications(repository, push, new Date('2026-11-11T23:05:00.000Z')),
    ).resolves.toMatchObject({ enviades: 0 });
    expect(push.send).not.toHaveBeenCalled();
  });

  it('envia en lots de 100 missatges; un lot que falla no atura els altres', async () => {
    const files = Array.from({ length: 150 }, (_, i) =>
      pendent({ alertaId: `alerta-${String(i).padStart(3, '0')}`, perfilId: `perfil-${i}` }),
    );
    const { repository, enviades } = repositoriEnMemoria(
      files,
      files.map((n) => ({ perfilId: n.perfilId, token: `token-${n.perfilId}` })),
    );
    const push = expoFals();
    jest.mocked(push.send).mockRejectedValueOnce(new Error('timeout'));

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 50,
      tokensEsborrats: 0,
      errors: ['timeout'],
    });
    expect(jest.mocked(push.send).mock.calls.map(([lot]) => lot.length)).toEqual([100, 50]);
    expect(enviades.size).toBe(50);
  });

  it('dues execucions alhora (dos workers contra la mateixa BD) no envien la mateixa dues vegades', async () => {
    const { repository } = repositoriEnMemoria([pendent()], [{ perfilId: 'perfil-1', token: 'a' }]);
    const push = expoFals();

    const [primera, segona] = await Promise.all([
      sendPendingNotifications(repository, push, ARA),
      sendPendingNotifications(repository, push, ARA),
    ]);

    expect(primera.enviades + segona.enviades).toBe(1);
    expect(push.send).toHaveBeenCalledTimes(1);
  });

  it('si desar els tickets falla, no la torna a enviar a la següent execució', async () => {
    const { repository } = repositoriEnMemoria([pendent()], [{ perfilId: 'perfil-1', token: 'a' }]);
    jest.mocked(repository.saveTickets).mockRejectedValueOnce(new Error('timeout'));
    const push = expoFals();

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 1,
      tokensEsborrats: 0,
      errors: ['timeout'],
    });
    await sendPendingNotifications(repository, push, new Date('2026-11-11T20:05:00.000Z'));
    expect(push.send).toHaveBeenCalledTimes(1);
  });

  it('si esborrar els tokens morts falla, les enviades queden desades i l’error al resum', async () => {
    const { repository, enviades } = repositoriEnMemoria(
      [pendent()],
      [
        { perfilId: 'perfil-1', token: 'mort' },
        { perfilId: 'perfil-1', token: 'viu' },
      ],
    );
    jest.mocked(repository.deleteTokens).mockRejectedValueOnce(new Error('connection terminated'));
    const push = expoFals((m) =>
      m.to === 'mort'
        ? { status: 'error', message: 'not registered', error: 'DeviceNotRegistered' }
        : { status: 'ok', id: 'ticket' },
    );

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toEqual({
      enviades: 1,
      tokensEsborrats: 0,
      errors: ['connection terminated'],
    });
    expect(enviades.size).toBe(1);
  });

  it('si no es poden llegir els tokens, no envia res i desfà les reserves', async () => {
    const { repository, reserves } = repositoriEnMemoria([pendent()], []);
    jest.mocked(repository.tokens).mockRejectedValueOnce(new Error('timeout'));
    const push = expoFals();

    await expect(sendPendingNotifications(repository, push, ARA)).resolves.toMatchObject({
      enviades: 0,
      errors: ['timeout'],
    });
    expect(push.send).not.toHaveBeenCalled();
    expect(reserves.size).toBe(0);
  });

  it('si desfer una reserva falla, aquella nit es perd però les altres es desfan', async () => {
    const { repository, reserves } = repositoriEnMemoria(
      [pendent({ alertaId: 'alerta-1' }), pendent({ alertaId: 'alerta-2' })],
      [],
    );
    jest.mocked(repository.release).mockRejectedValueOnce(new Error('timeout'));

    await expect(sendPendingNotifications(repository, expoFals(), ARA)).resolves.toMatchObject({
      errors: ['timeout'],
    });
    expect([...reserves.keys()]).toEqual(['alerta-1|2026-11-11']);
  });
});

describe('createAlertsStep · enviament (TG-154)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  // L'avaluació no troba res de nou: el que s'envia són les pendents d'abans (els reintents).
  const avaluacio: AlertesRepository = {
    candidates: async () => [],
    saveNotifications: async (notificacions) => notificacions,
  };

  it('després d’avaluar, envia les pendents', async () => {
    const { repository, enviades } = repositoriEnMemoria(
      [pendent()],
      [{ perfilId: 'perfil-1', token: 'a' }],
    );
    const pas = createAlertsStep(avaluacio, { repository, push: expoFals() });

    await expect(pas(ARA)).resolves.toEqual({ notificacions: 0 });
    expect(enviades.size).toBe(1);
  });

  it("els errors d'Expo van a errorEnviament, amb les notificacions noves igualment", async () => {
    const { repository } = repositoriEnMemoria([pendent()], [{ perfilId: 'perfil-1', token: 'a' }]);
    const push = expoFals();
    jest.mocked(push.send).mockRejectedValueOnce(new Error('timeout'));

    await expect(createAlertsStep(avaluacio, { repository, push })(ARA)).resolves.toEqual({
      notificacions: 0,
      errorEnviament: 'timeout',
    });
  });

  it('un error de la base de dades en enviar també va a errorEnviament', async () => {
    const { repository } = repositoriEnMemoria([], []);
    jest.mocked(repository.claim).mockRejectedValueOnce(new Error('connection terminated'));

    await expect(
      createAlertsStep(avaluacio, { repository, push: expoFals() })(ARA),
    ).resolves.toEqual({
      notificacions: 0,
      errorEnviament: 'connection terminated',
    });
  });
});

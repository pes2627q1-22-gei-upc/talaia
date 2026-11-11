import {
  alertsWindow,
  createAlertsStep,
  evaluateAlerts,
  pickNotifications,
  type AlertCandidate,
  type AlertesRepository,
  type AlertsWindow,
  type NotificacioAlerta,
} from '../avaluacio';

// Dimecres 11/11/2026 a les 20:05 de Catalunya (UTC+1): la nit de l'11, que acaba dijous a les
// 12:00 locals (11:00Z). L'hora en curs és la de les 19:00Z.
const ARA = new Date('2026-11-11T19:05:00.000Z');
const FINESTRA: AlertsWindow = {
  nit: '2026-11-11',
  from: new Date('2026-11-11T19:00:00.000Z'),
  to: new Date('2026-11-12T11:00:00.000Z'),
};

const candidat = (canvis: Partial<AlertCandidate> = {}): AlertCandidate => ({
  alertaId: 'alerta-1',
  perfilId: 'perfil-1',
  objectiu: 'cel_estrellat',
  activa: true,
  indexMinim: 60,
  distanciaMaxKm: 50,
  puntId: 'montsec',
  puntNom: 'Montsec',
  distanciaKm: 20,
  hora: '2026-11-11T22:00:00.000Z',
  index: 75,
  ...canvis,
});

const iso = ({ nit, from, to }: AlertsWindow) => ({
  nit,
  from: from.toISOString(),
  to: to.toISOString(),
});

describe('alertsWindow', () => {
  it("és la nit en curs, des de l'hora en curs fins a les 12:00 locals de l'endemà", () => {
    expect(alertsWindow(ARA)).toEqual(FINESTRA);
  });

  it('a les 12:00 locals comença la nit nova, sencera; un minut abans només queda una hora', () => {
    expect(iso(alertsWindow(new Date('2026-11-11T11:00:00.000Z')))).toEqual({
      nit: '2026-11-11',
      from: '2026-11-11T11:00:00.000Z',
      to: '2026-11-12T11:00:00.000Z',
    });
    expect(iso(alertsWindow(new Date('2026-11-11T10:59:00.000Z')))).toEqual({
      nit: '2026-11-10',
      from: '2026-11-11T10:00:00.000Z',
      to: '2026-11-11T11:00:00.000Z',
    });
  });

  it('de matinada encara és la nit del vespre, i només en queden les hores que falten', () => {
    // 04:30 locals de dijous.
    expect(iso(alertsWindow(new Date('2026-11-12T03:30:00.000Z')))).toEqual({
      nit: '2026-11-11',
      from: '2026-11-12T03:00:00.000Z',
      to: '2026-11-12T11:00:00.000Z',
    });
  });

  it("a l'estiu (UTC+2) el migdia local és a les 10:00Z", () => {
    expect(alertsWindow(new Date('2026-07-15T09:59:00.000Z')).nit).toBe('2026-07-14');
    expect(iso(alertsWindow(new Date('2026-07-15T10:00:00.000Z')))).toEqual({
      nit: '2026-07-15',
      from: '2026-07-15T10:00:00.000Z',
      to: '2026-07-16T10:00:00.000Z',
    });
  });

  it("la nit en què s'acaba l'hora d'estiu dura 25 hores", () => {
    // 25/10/2026: a les 03:00 d'estiu (01:00Z) es tornen les 02:00. La nit del 24 comença a les
    // 12:00 d'estiu (10:00Z) i acaba a les 12:00 d'hivern (11:00Z).
    expect(iso(alertsWindow(new Date('2026-10-24T10:00:00.000Z')))).toEqual({
      nit: '2026-10-24',
      from: '2026-10-24T10:00:00.000Z',
      to: '2026-10-25T11:00:00.000Z',
    });
    // 02:30 d'estiu, abans del canvi, i 11:30 d'hivern, la darrera hora de la nit.
    expect(alertsWindow(new Date('2026-10-25T00:30:00.000Z')).nit).toBe('2026-10-24');
    expect(iso(alertsWindow(new Date('2026-10-25T10:30:00.000Z')))).toEqual({
      nit: '2026-10-24',
      from: '2026-10-25T10:00:00.000Z',
      to: '2026-10-25T11:00:00.000Z',
    });
    expect(alertsWindow(new Date('2026-10-25T11:00:00.000Z')).nit).toBe('2026-10-25');
  });

  it("la nit en què comença l'hora d'estiu dura 23 hores", () => {
    // 28/03/2027: a les 02:00 d'hivern (01:00Z) passen a ser les 03:00.
    const finestra = alertsWindow(new Date('2027-03-27T11:00:00.000Z'));
    expect(iso(finestra)).toEqual({
      nit: '2027-03-27',
      from: '2027-03-27T11:00:00.000Z',
      to: '2027-03-28T10:00:00.000Z',
    });
    expect((finestra.to.getTime() - finestra.from.getTime()) / 3_600_000).toBe(23);
    // 11:59 d'estiu: encara la nit del 27.
    expect(alertsWindow(new Date('2027-03-28T09:59:00.000Z')).nit).toBe('2027-03-27');
  });

  it("passa d'any", () => {
    // 00:30 locals de l'1 de gener: la nit del 31.
    expect(iso(alertsWindow(new Date('2026-12-31T23:30:00.000Z')))).toEqual({
      nit: '2026-12-31',
      from: '2026-12-31T23:00:00.000Z',
      to: '2027-01-01T11:00:00.000Z',
    });
  });
});

describe('pickNotifications', () => {
  it("dona el punt, l'hora i l'índex d'una alerta que arriba al mínim", () => {
    expect(pickNotifications([candidat()], FINESTRA)).toEqual<NotificacioAlerta[]>([
      {
        alertaId: 'alerta-1',
        perfilId: 'perfil-1',
        objectiu: 'cel_estrellat',
        nit: '2026-11-11',
        puntId: 'montsec',
        puntNom: 'Montsec',
        distanciaKm: 20,
        hora: '2026-11-11T22:00:00.000Z',
        index: 75,
      },
    ]);
  });

  it("l'índex just al mínim compta; un per sota, no", () => {
    expect(pickNotifications([candidat({ index: 60 })], FINESTRA)).toHaveLength(1);
    expect(pickNotifications([candidat({ index: 59 })], FINESTRA)).toEqual([]);
    expect(pickNotifications([candidat({ indexMinim: 100, index: 100 })], FINESTRA)).toHaveLength(
      1,
    );
  });

  it('un índex 0 no notifica mai, tampoc amb el mínim a 0', () => {
    expect(pickNotifications([candidat({ indexMinim: 0, index: 0 })], FINESTRA)).toEqual([]);
    expect(pickNotifications([candidat({ indexMinim: 0, index: 1 })], FINESTRA)).toHaveLength(1);
  });

  it('un punt fora del radi no compta; just a la vora, sí', () => {
    expect(pickNotifications([candidat({ distanciaKm: 50.001 })], FINESTRA)).toEqual([]);
    expect(pickNotifications([candidat({ distanciaKm: 50 })], FINESTRA)).toHaveLength(1);
  });

  it('una alerta inactiva no notifica, encara que tingui el millor punt', () => {
    expect(pickNotifications([candidat({ activa: false, index: 100 })], FINESTRA)).toEqual([]);
  });

  it("només compten les hores que queden de la nit: l'hora en curs sí, les passades i la del migdia no", () => {
    const hores = (hora: string) => pickNotifications([candidat({ hora })], FINESTRA);
    expect(hores('2026-11-11T18:00:00.000Z')).toEqual([]); // ja ha passat
    expect(hores('2026-11-11T19:00:00.000Z')).toHaveLength(1); // l'hora en curs
    expect(hores('2026-11-12T10:00:00.000Z')).toHaveLength(1); // la darrera de la nit
    expect(hores('2026-11-12T11:00:00.000Z')).toEqual([]); // ja és la nit següent
  });

  it("guanya l'índex més alt, encara que el punt sigui més lluny i l'hora més tard", () => {
    const [notificacio] = pickNotifications(
      [
        candidat({ puntId: 'a-prop', distanciaKm: 5, hora: '2026-11-11T20:00:00.000Z', index: 80 }),
        candidat({ puntId: 'lluny', distanciaKm: 45, hora: '2026-11-12T03:00:00.000Z', index: 81 }),
      ],
      FINESTRA,
    );
    expect(notificacio).toMatchObject({ puntId: 'lluny', index: 81 });
  });

  it("amb el mateix índex, el punt més proper; i al mateix punt, l'hora més d'hora", () => {
    const [proper] = pickNotifications(
      [
        candidat({ puntId: 'lluny', distanciaKm: 30, hora: '2026-11-11T20:00:00.000Z' }),
        candidat({ puntId: 'a-prop', distanciaKm: 10, hora: '2026-11-12T02:00:00.000Z' }),
      ],
      FINESTRA,
    );
    expect(proper).toMatchObject({ puntId: 'a-prop', hora: '2026-11-12T02:00:00.000Z' });

    const [dHora] = pickNotifications(
      [
        candidat({ hora: '2026-11-12T02:00:00.000Z' }),
        candidat({ hora: '2026-11-11T23:00:00.000Z' }),
        candidat({ hora: '2026-11-12T00:00:00.000Z' }),
      ],
      FINESTRA,
    );
    expect(dHora?.hora).toBe('2026-11-11T23:00:00.000Z');
  });

  it("el resultat no depèn de l'ordre de les files, tampoc en un empat complet", () => {
    const files = [
      candidat({ puntId: 'b' }),
      candidat({ puntId: 'a' }),
      candidat({ puntId: 'c', index: 70 }),
    ];
    expect(pickNotifications(files, FINESTRA)).toEqual(
      pickNotifications([...files].reverse(), FINESTRA),
    );
    expect(pickNotifications(files, FINESTRA)[0]?.puntId).toBe('a');
  });

  it('dona com a molt una notificació per alerta, ordenades per alerta', () => {
    const notificacions = pickNotifications(
      [
        candidat({ alertaId: 'alerta-2', perfilId: 'perfil-2', puntId: 'siurana', index: 90 }),
        candidat({ alertaId: 'alerta-1', puntId: 'montsec', index: 70 }),
        candidat({ alertaId: 'alerta-2', perfilId: 'perfil-2', puntId: 'prades', index: 65 }),
        candidat({ alertaId: 'alerta-1', puntId: 'boixols', index: 72 }),
        // Cap candidat de l'alerta 3 arriba al seu mínim.
        candidat({ alertaId: 'alerta-3', indexMinim: 95, index: 94 }),
      ],
      FINESTRA,
    );
    expect(notificacions.map((n) => [n.alertaId, n.perfilId, n.puntId, n.index])).toEqual([
      ['alerta-1', 'perfil-1', 'boixols', 72],
      ['alerta-2', 'perfil-2', 'siurana', 90],
    ]);
  });

  it("porta l'objectiu de l'alerta: a la v1 tots fan servir el mateix índex", () => {
    const [notificacio] = pickNotifications([candidat({ objectiu: 'via_lactia' })], FINESTRA);
    expect(notificacio).toMatchObject({ objectiu: 'via_lactia', index: 75 });
  });

  it('sense candidats, cap notificació', () => {
    expect(pickNotifications([], FINESTRA)).toEqual([]);
  });
});

/**
 * Repositori en memòria amb la clau primària (alerta, nit) de `notificacions_alertes`. La
 * consulta no filtra les alertes ja notificades, com si dues execucions la fessin alhora: així
 * es prova que la clau sola ja evita la segona notificació.
 */
function repositoriEnMemoria(candidats: AlertCandidate[]) {
  const desades = new Map<string, NotificacioAlerta>();
  const repository: AlertesRepository = {
    candidates: jest.fn(async () => candidats),
    saveNotifications: jest.fn(async (notificacions) =>
      notificacions.filter((n) => {
        const clau = `${n.alertaId}|${n.nit}`;
        if (desades.has(clau)) return false;
        desades.set(clau, n);
        return true;
      }),
    ),
  };
  return { repository, desades };
}

describe('evaluateAlerts', () => {
  it('demana els candidats de la finestra de la nit en curs i en desa la millor notificació', async () => {
    const { repository, desades } = repositoriEnMemoria([
      candidat({ puntId: 'montsec', index: 70 }),
      candidat({ puntId: 'boixols', index: 82 }),
    ]);

    const avaluacio = await evaluateAlerts(repository, ARA);

    expect(repository.candidates).toHaveBeenCalledWith(FINESTRA);
    expect(avaluacio.nit).toBe('2026-11-11');
    expect(avaluacio.notificacions).toEqual([
      expect.objectContaining({ alertaId: 'alerta-1', puntId: 'boixols', index: 82 }),
    ]);
    expect([...desades.keys()]).toEqual(['alerta-1|2026-11-11']);
  });

  it('no notifica dues vegades la mateixa alerta la mateixa nit, encara que millori', async () => {
    const candidats = [candidat({ index: 70 })];
    const { repository, desades } = repositoriEnMemoria(candidats);

    await evaluateAlerts(repository, ARA);
    candidats.push(candidat({ puntId: 'boixols', index: 95 }));
    const segona = await evaluateAlerts(repository, new Date('2026-11-11T20:05:00.000Z'));
    const deMatinada = await evaluateAlerts(repository, new Date('2026-11-12T02:05:00.000Z'));

    expect(segona.notificacions).toEqual([]);
    expect(deMatinada.notificacions).toEqual([]);
    expect(desades.size).toBe(1);
    expect(desades.get('alerta-1|2026-11-11')).toMatchObject({ puntId: 'montsec', index: 70 });
  });

  it('la nit següent la mateixa alerta torna a notificar', async () => {
    const { repository } = repositoriEnMemoria([
      candidat({ hora: '2026-11-11T22:00:00.000Z' }),
      candidat({ hora: '2026-11-12T22:00:00.000Z' }),
    ]);

    const avui = await evaluateAlerts(repository, ARA);
    const dema = await evaluateAlerts(repository, new Date('2026-11-12T19:05:00.000Z'));

    expect(avui.notificacions.map((n) => [n.nit, n.hora])).toEqual([
      ['2026-11-11', '2026-11-11T22:00:00.000Z'],
    ]);
    expect(dema.notificacions.map((n) => [n.nit, n.hora])).toEqual([
      ['2026-11-12', '2026-11-12T22:00:00.000Z'],
    ]);
  });

  it('si cap hora no arriba al mínim, no desa res i la nit queda lliure per a una previsió millor', async () => {
    const candidats = [candidat({ index: 50 })];
    const { repository } = repositoriEnMemoria(candidats);

    const primera = await evaluateAlerts(repository, ARA);
    candidats.splice(0, 1, candidat({ index: 65 }));
    const segona = await evaluateAlerts(repository, new Date('2026-11-11T20:05:00.000Z'));

    expect(primera.notificacions).toEqual([]);
    expect(repository.saveNotifications).toHaveBeenNthCalledWith(1, []);
    expect(segona.notificacions).toEqual([expect.objectContaining({ index: 65 })]);
  });

  it("torna només les notificacions noves, que són les que s'han d'enviar", async () => {
    const { repository } = repositoriEnMemoria([
      candidat({ alertaId: 'alerta-1' }),
      candidat({ alertaId: 'alerta-2' }),
    ]);
    // Una altra execució ja ha notificat l'alerta 2 aquesta nit.
    await repository.saveNotifications(
      pickNotifications([candidat({ alertaId: 'alerta-2' })], FINESTRA),
    );

    const { notificacions } = await evaluateAlerts(repository, ARA);

    expect(notificacions.map((n) => n.alertaId)).toEqual(['alerta-1']);
  });

  it('un error de la base de dades es propaga: el recàlcul el recull sense fallar', async () => {
    const repository: AlertesRepository = {
      candidates: async () => {
        throw new Error('BD caiguda');
      },
      saveNotifications: jest.fn(),
    };
    await expect(evaluateAlerts(repository, ARA)).rejects.toThrow('BD caiguda');
    expect(repository.saveNotifications).not.toHaveBeenCalled();
  });
});

describe('createAlertsStep', () => {
  it("torna quantes notificacions noves ha desat l'avaluació", async () => {
    const { repository } = repositoriEnMemoria([
      candidat({ alertaId: 'alerta-1' }),
      candidat({ alertaId: 'alerta-2' }),
    ]);
    const pas = createAlertsStep(repository);

    await expect(pas(ARA)).resolves.toEqual({ notificacions: 2 });
    await expect(pas(ARA)).resolves.toEqual({ notificacions: 0 });
  });
});

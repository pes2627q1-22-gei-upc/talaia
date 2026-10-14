import {
  ALCADA_CREPUSCLE,
  ALCADA_SOL_HORITZO,
  efemeridesHora,
  efemeridesHores,
  estatLluna,
  faseLunar,
  franjaCrepuscle,
  nitAstronomica,
  nomFaseLunar,
  posicioSol,
} from '../astronomia';

const BARCELONA = { lat: 41.3851, lon: 2.1734 };
const MONTSEC = { lat: 42.0294, lon: 0.7112, altitud: 1570 };
/** Latitud alta per provar el Sol que no es pon i els crepuscles que no arriben. */
const TROMSO = { lat: 69.65, lon: 18.96 };

const minuts = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 60_000;

describe('franjaCrepuscle', () => {
  it.each([
    [10, 'dia'],
    [0, 'dia'],
    [-0.5, 'dia'],
    [-1, 'civil'],
    [-6, 'nautic'],
    [-11.9, 'nautic'],
    [-12, 'astronomic'],
    [-17.9, 'astronomic'],
    [-18, 'nit'],
    [-50, 'nit'],
  ] as const)('alçada %p → %p', (alcada, franja) => {
    expect(franjaCrepuscle(alcada)).toBe(franja);
  });

  it('fa servir els llindars estàndard', () => {
    expect(ALCADA_SOL_HORITZO).toBeCloseTo(-0.8333, 3);
    expect(ALCADA_CREPUSCLE).toEqual({ civil: -6, nautic: -12, astronomic: -18 });
  });
});

describe('nomFaseLunar', () => {
  it.each([
    [0, 'nova'],
    [22.4, 'nova'],
    [22.5, 'creixent'],
    [90, 'quart_creixent'],
    [135, 'gibosa_creixent'],
    [180, 'plena'],
    [225, 'gibosa_minvant'],
    [270, 'quart_minvant'],
    [315, 'minvant'],
    [337.4, 'minvant'],
    [337.5, 'nova'],
    [359.9, 'nova'],
  ] as const)('angle %p → %p', (angle, fase) => {
    expect(nomFaseLunar(angle)).toBe(fase);
  });

  it('normalitza angles fora de 0–360', () => {
    expect(nomFaseLunar(360)).toBe('nova');
    expect(nomFaseLunar(-90)).toBe('quart_minvant');
    expect(nomFaseLunar(450)).toBe('quart_creixent');
  });

  it('rebutja un angle que no és un nombre', () => {
    expect(() => nomFaseLunar(Number.NaN)).toThrow(RangeError);
  });
});

describe('faseLunar', () => {
  // Fets independents de la llibreria: un eclipsi solar passa amb Lluna nova i un de lunar, amb
  // Lluna plena. Eclipsi solar total del 12/08/2026 (màxim 17:46 UTC) i eclipsi lunar total del
  // 03/03/2026 (màxim 11:34 UTC), segons la NASA.
  it('és nova durant l’eclipsi solar del 12 d’agost de 2026', () => {
    const fase = faseLunar('2026-08-12T17:46:00Z');
    expect(fase.fase).toBe('nova');
    expect(fase.angleFase).toBeLessThan(1);
    expect(fase.fraccioIlluminada).toBeLessThan(0.001);
  });

  it('és plena durant l’eclipsi lunar del 3 de març de 2026', () => {
    const fase = faseLunar('2026-03-03T11:34:00Z');
    expect(fase.fase).toBe('plena');
    expect(fase.angleFase).toBeCloseTo(180, 0);
    expect(fase.fraccioIlluminada).toBeGreaterThan(0.999);
  });

  it('arrodoneix la fracció a 3 decimals i l’angle a 1', () => {
    const fase = faseLunar('2026-10-14T22:00:00Z');
    expect(fase.fraccioIlluminada).toBe(Number(fase.fraccioIlluminada.toFixed(3)));
    expect(fase.angleFase).toBe(Number(fase.angleFase.toFixed(1)));
  });

  it('rebutja un instant que no és ISO 8601', () => {
    expect(() => faseLunar('ahir a la nit')).toThrow(RangeError);
  });
});

describe('posicioSol', () => {
  it('al migdia del solstici d’estiu a Barcelona arriba a 90° − latitud + 23,44°', () => {
    // Migdia solar de Barcelona (lon 2,17° E): 11:51 UTC, amb l'equació del temps gairebé nul·la.
    const sol = posicioSol(BARCELONA, '2026-06-21T11:51:00Z');
    expect(sol.alcada).toBeCloseTo(90 - BARCELONA.lat + 23.44, 0);
    expect(sol.azimut).toBeCloseTo(180, -1);
  });

  it('és sota l’horitzó a mitjanit', () => {
    const sol = posicioSol(BARCELONA, '2026-10-14T23:00:00Z');
    expect(sol.alcada).toBeLessThan(-40);
    expect(sol.azimut).toBeGreaterThanOrEqual(0);
    expect(sol.azimut).toBeLessThan(360);
  });

  it.each([
    [{ lat: 91, lon: 2 }, /lat/],
    [{ lat: Number.NaN, lon: 2 }, /lat/],
    [{ lat: 41, lon: 181 }, /lon/],
    [{ lat: 41, lon: 2, altitud: Number.POSITIVE_INFINITY }, /altitud/],
  ])('rebutja el lloc invàlid %p', (lloc, missatge) => {
    expect(() => posicioSol(lloc, '2026-10-14T22:00:00Z')).toThrow(missatge);
  });

  it('admet altitud null', () => {
    expect(() => posicioSol({ ...BARCELONA, altitud: null }, '2026-10-14T22:00:00Z')).not.toThrow();
  });
});

describe('estatLluna', () => {
  it('ajunta posició i fase', () => {
    const lluna = estatLluna(BARCELONA, '2026-10-14T17:00:00Z');
    expect(lluna).toEqual({
      alcada: expect.any(Number),
      azimut: expect.any(Number),
      ...faseLunar('2026-10-14T17:00:00Z'),
    });
    // Lluna creixent de 4 dies, al vespre: encara sobre l'horitzó, cap al sud-oest.
    expect(lluna.alcada).toBeGreaterThan(0);
    expect(lluna.azimut).toBeGreaterThan(180);
    expect(lluna.azimut).toBeLessThan(270);
  });
});

describe('efemeridesHora', () => {
  it('retorna Sol, crepuscle i Lluna coherents entre ells', () => {
    const hora = '2026-10-14T22:00:00.000Z';
    const efemerides = efemeridesHora(BARCELONA, hora);
    expect(efemerides).toEqual({
      hora,
      sol: posicioSol(BARCELONA, hora),
      crepuscle: 'nit',
      lluna: estatLluna(BARCELONA, hora),
    });
    expect(efemerides.crepuscle).toBe(franjaCrepuscle(efemerides.sol.alcada));
  });

  it('normalitza l’hora a ISO 8601 en UTC', () => {
    expect(efemeridesHora(BARCELONA, '2026-10-14T19:00:00+02:00').hora).toBe(
      '2026-10-14T17:00:00.000Z',
    );
  });

  it('classifica el crepuscle segons l’hora de la nit', () => {
    const nit = nitAstronomica(BARCELONA, '2026-10-14');
    const unMinutAbans = (iso: string) => new Date(Date.parse(iso) - 60_000).toISOString();
    const unMinutDespres = (iso: string) => new Date(Date.parse(iso) + 60_000).toISOString();

    expect(efemeridesHora(BARCELONA, unMinutAbans(nit.postaSol)).crepuscle).toBe('dia');
    expect(efemeridesHora(BARCELONA, unMinutDespres(nit.postaSol)).crepuscle).toBe('civil');
    expect(efemeridesHora(BARCELONA, unMinutDespres(nit.fiCrepuscleCivil!)).crepuscle).toBe(
      'nautic',
    );
    expect(efemeridesHora(BARCELONA, unMinutDespres(nit.fiCrepuscleNautic!)).crepuscle).toBe(
      'astronomic',
    );
    expect(efemeridesHora(BARCELONA, unMinutDespres(nit.fiCrepuscleAstronomic!)).crepuscle).toBe(
      'nit',
    );
    expect(efemeridesHora(BARCELONA, unMinutAbans(nit.iniciCrepuscleAstronomic!)).crepuscle).toBe(
      'nit',
    );
    expect(efemeridesHora(BARCELONA, unMinutDespres(nit.iniciCrepuscleCivil!)).crepuscle).toBe(
      'civil',
    );
    expect(efemeridesHora(BARCELONA, unMinutDespres(nit.sortidaSol)).crepuscle).toBe('dia');
  });
});

describe('efemeridesHores', () => {
  const HORES = [
    '2026-10-14T21:00:00.000Z',
    '2026-10-14T22:00:00.000Z',
    '2026-10-14T23:00:00.000Z',
  ];

  it('retorna una efemèride per hora, en el mateix ordre', () => {
    const efemerides = efemeridesHores(MONTSEC, HORES);
    expect(efemerides.map((e) => e.hora)).toEqual(HORES);
    expect(efemerides[1]).toEqual(efemeridesHora(MONTSEC, HORES[1]!));
  });

  it('amb una llista buida retorna una llista buida però valida el lloc', () => {
    expect(efemeridesHores(MONTSEC, [])).toEqual([]);
    expect(() => efemeridesHores({ lat: 100, lon: 0 }, [])).toThrow(RangeError);
  });

  it('falla si alguna hora no és vàlida', () => {
    expect(() => efemeridesHores(MONTSEC, [HORES[0]!, 'demà'])).toThrow(RangeError);
  });
});

describe('nitAstronomica', () => {
  const nit = nitAstronomica(BARCELONA, '2026-10-14');

  it('dóna la posta i la sortida del Sol de la nit del 14 d’octubre de 2026 a Barcelona', () => {
    // Referència: 19:12 i 08:03 hora local (CEST, UTC+2), amb un marge de 2 minuts.
    expect(nit.data).toBe('2026-10-14');
    expect(minuts(nit.postaSol, '2026-10-14T17:12:00Z')).toBeLessThan(2);
    expect(minuts(nit.sortidaSol, '2026-10-15T06:03:00Z')).toBeLessThan(2);
  });

  it('ordena els crepuscles entre la posta i la sortida del Sol', () => {
    const instants = [
      nit.postaSol,
      nit.fiCrepuscleCivil,
      nit.fiCrepuscleNautic,
      nit.fiCrepuscleAstronomic,
      nit.iniciCrepuscleAstronomic,
      nit.iniciCrepuscleNautic,
      nit.iniciCrepuscleCivil,
      nit.sortidaSol,
    ].map((iso) => Date.parse(iso!));
    for (let i = 1; i < instants.length; i++) expect(instants[i]).toBeGreaterThan(instants[i - 1]!);
    // A la tardor, a Barcelona, cada crepuscle dura entre 25 i 35 minuts.
    expect(minuts(nit.postaSol, nit.fiCrepuscleCivil!)).toBeGreaterThan(25);
    expect(minuts(nit.fiCrepuscleNautic!, nit.fiCrepuscleAstronomic!)).toBeLessThan(35);
  });

  it('el Sol és just al llindar en cada esdeveniment', () => {
    expect(posicioSol(BARCELONA, nit.postaSol).alcada).toBeCloseTo(ALCADA_SOL_HORITZO, 1);
    expect(posicioSol(BARCELONA, nit.fiCrepuscleCivil!).alcada).toBeCloseTo(-6, 1);
    expect(posicioSol(BARCELONA, nit.fiCrepuscleNautic!).alcada).toBeCloseTo(-12, 1);
    expect(posicioSol(BARCELONA, nit.fiCrepuscleAstronomic!).alcada).toBeCloseTo(-18, 1);
    expect(posicioSol(BARCELONA, nit.iniciCrepuscleAstronomic!).alcada).toBeCloseTo(-18, 1);
    expect(posicioSol(BARCELONA, nit.sortidaSol).alcada).toBeCloseTo(ALCADA_SOL_HORITZO, 1);
  });

  it('dóna la posta de la Lluna creixent al vespre i cap sortida dins la nit', () => {
    // Lluna de 4 dies: es pon poc després del Sol i no torna a sortir fins passada l'alba.
    expect(nit.postaLluna).not.toBeNull();
    expect(Date.parse(nit.postaLluna!)).toBeGreaterThan(Date.parse(nit.postaSol));
    expect(Date.parse(nit.postaLluna!)).toBeLessThan(Date.parse(nit.sortidaSol));
    expect(nit.sortidaLluna).toBeNull();
    expect(nit.lluna.fase).toBe('creixent');
    expect(nit.lluna.fraccioIlluminada).toBeGreaterThan(0.1);
    expect(nit.lluna.fraccioIlluminada).toBeLessThan(0.3);
  });

  it('amb Lluna plena, la Lluna ni surt ni es pon dins la nit', () => {
    // Lluna plena el 26/10/2026: surt abans de la posta del Sol i es pon després de la sortida.
    const plena = nitAstronomica(BARCELONA, '2026-10-25');
    expect(plena.lluna.fase).toBe('plena');
    expect(plena.lluna.fraccioIlluminada).toBeGreaterThan(0.99);
    expect(plena.sortidaLluna).toBeNull();
    expect(plena.postaLluna).toBeNull();
  });

  it('amb Lluna nova, la Lluna surt de matinada poc abans que el Sol', () => {
    const nova = nitAstronomica(BARCELONA, '2026-10-09');
    expect(nova.lluna.fase).toBe('nova');
    expect(nova.sortidaLluna).not.toBeNull();
    expect(minuts(nova.sortidaLluna!, nova.sortidaSol)).toBeLessThan(30);
  });

  it('les nits d’estiu són curtes i les d’hivern llargues', () => {
    const estiu = nitAstronomica(BARCELONA, '2026-06-21');
    const hivern = nitAstronomica(BARCELONA, '2026-12-21');
    expect(minuts(estiu.postaSol, estiu.sortidaSol) / 60).toBeCloseTo(8.8, 0);
    expect(minuts(hivern.postaSol, hivern.sortidaSol) / 60).toBeCloseTo(14.8, 0);
    // Al solstici d'estiu encara hi ha foscor astronòmica a Barcelona (unes 4,5 h).
    expect(estiu.fiCrepuscleAstronomic).not.toBeNull();
    expect(minuts(estiu.fiCrepuscleAstronomic!, estiu.iniciCrepuscleAstronomic!) / 60).toBeCloseTo(
      4.5,
      0,
    );
  });

  it('el Montsec, més al nord i a l’oest, veu pondre’s el Sol més tard que Barcelona', () => {
    const montsec = nitAstronomica(MONTSEC, '2026-10-14');
    expect(Date.parse(montsec.postaSol)).toBeGreaterThan(Date.parse(nit.postaSol));
    expect(minuts(montsec.postaSol, nit.postaSol)).toBeLessThan(10);
  });

  it('els instants són ISO 8601 en UTC al segon', () => {
    for (const valor of Object.values(nit)) {
      if (typeof valor === 'string' && valor.endsWith('Z')) {
        expect(valor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
      }
    }
  });

  it('deixa a null els crepuscles que el Sol no arriba a fer (latituds altes)', () => {
    const tromso = nitAstronomica(TROMSO, '2026-07-30');
    expect(tromso.postaSol).toBeDefined();
    expect(tromso.fiCrepuscleCivil).toBeNull();
    expect(tromso.fiCrepuscleAstronomic).toBeNull();
    expect(tromso.iniciCrepuscleAstronomic).toBeNull();
    expect(tromso.iniciCrepuscleCivil).toBeNull();
  });

  it('falla si el Sol no es pon (sol de mitjanit)', () => {
    expect(() => nitAstronomica(TROMSO, '2026-06-21')).toThrow(/no es pon/);
  });

  it.each(['14/10/2026', '2026-10-14T00:00:00Z', '2026-13-01', ''])(
    'rebutja la data invàlida %p',
    (data) => {
      expect(() => nitAstronomica(BARCELONA, data)).toThrow(RangeError);
    },
  );
});

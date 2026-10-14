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

  it.each([
    'ahir a la nit',
    'Oct 14 2026 22:00',
    '2026-10-14',
    // Sense zona, JavaScript ho llegiria com a hora local de la màquina: el resultat dependria de TZ.
    '2026-10-14T22:00',
    '2026-10-14T22:00:00',
    '2026-10-14T22:00:00+0200',
  ])('rebutja l’instant %p (no és ISO 8601 amb zona)', (hora) => {
    expect(() => faseLunar(hora)).toThrow(RangeError);
  });

  it.each(['2026-10-14T22:00Z', '2026-10-14T22:00:00Z', '2026-10-14T22:00:00.000Z'])(
    'accepta %p',
    (hora) => {
      expect(faseLunar(hora)).toEqual(faseLunar('2026-10-14T22:00:00.000Z'));
    },
  );
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
  it('coincideix amb JPL Horizons a Barcelona el 20/10/2026 a les 20:00Z', () => {
    // Horizons (sense refracció): alçada 32,475°, azimut 188,668°.
    const lluna = estatLluna(BARCELONA, '2026-10-20T20:00:00Z');
    expect(lluna.alcada).toBeCloseTo(32.48, 1);
    expect(lluna.azimut).toBeCloseTo(188.67, 1);
  });

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

  it('no depèn de la zona horària de la màquina', () => {
    // Amb zona obligatòria, el mateix text dóna el mateix instant amb qualsevol TZ.
    expect(() => efemeridesHora(BARCELONA, '2026-10-14T22:00')).toThrow(/zona/);
    expect(efemeridesHora(BARCELONA, '2026-10-14T22:00:00Z').sol.alcada).toBeCloseTo(-50.6, 0);
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

  it('coincideix amb l’USNO la nit del 14 d’octubre de 2026 a Barcelona', () => {
    // USNO (hora local CEST, UTC+2): posta 19:12, fi del crepuscle civil 19:40, posta de la
    // Lluna 20:58, sortida del Sol 08:03. Marge d'un minut, que és la precisió de la font.
    expect(nit.data).toBe('2026-10-14');
    expect(minuts(nit.postaSol, '2026-10-14T17:12:00Z')).toBeLessThan(1);
    expect(minuts(nit.fiCrepuscleCivil!, '2026-10-14T17:40:00Z')).toBeLessThan(1);
    expect(minuts(nit.postaLluna!, '2026-10-14T18:58:00Z')).toBeLessThan(1);
    expect(minuts(nit.sortidaSol, '2026-10-15T06:03:00Z')).toBeLessThan(1);
  });

  it('coincideix amb JPL Horizons als crepuscles nàutic i astronòmic', () => {
    // Horizons dóna el Sol a −12,01° a les 18:12Z i a −18,01° a les 18:44Z.
    expect(minuts(nit.fiCrepuscleNautic!, '2026-10-14T18:12:00Z')).toBeLessThan(1);
    expect(minuts(nit.fiCrepuscleAstronomic!, '2026-10-14T18:44:00Z')).toBeLessThan(1);
  });

  it('la nit del canvi d’hora (24 → 25/10/2026) no fa cap salt perquè tot és UTC', () => {
    // USNO: el Sol surt a les 07:14 CET (UTC+1) el 25/10, és a dir, 06:14Z.
    const canvi = nitAstronomica(BARCELONA, '2026-10-24');
    expect(minuts(canvi.sortidaSol, '2026-10-25T06:14:00Z')).toBeLessThan(1);
    expect(minuts(canvi.postaSol, canvi.sortidaSol) / 60).toBeCloseTo(13, 0);
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
    expect(nit.llunaSobreHoritzoALaPosta).toBe(true);
    expect(nit.lluna.fase).toBe('creixent');
    expect(nit.lluna.fraccioIlluminada).toBeGreaterThan(0.1);
    expect(nit.lluna.fraccioIlluminada).toBeLessThan(0.3);
  });

  it('amb Lluna plena, la Lluna hi és tota la nit: ni surt ni es pon', () => {
    // Lluna plena el 26/10/2026: surt abans de la posta del Sol i es pon després de la sortida.
    const plena = nitAstronomica(BARCELONA, '2026-10-25');
    expect(plena.lluna.fase).toBe('plena');
    expect(plena.lluna.fraccioIlluminada).toBeGreaterThan(0.99);
    expect(plena.llunaSobreHoritzoALaPosta).toBe(true);
    expect(plena.sortidaLluna).toBeNull();
    expect(plena.postaLluna).toBeNull();
  });

  it('amb Lluna nova, no hi ha Lluna en tota la nit', () => {
    // Lluna nova el 10/10/2026: es pon abans que el Sol i surt després de l'alba.
    const nova = nitAstronomica(BARCELONA, '2026-10-10');
    expect(nova.lluna.fase).toBe('nova');
    expect(nova.llunaSobreHoritzoALaPosta).toBe(false);
    expect(nova.sortidaLluna).toBeNull();
    expect(nova.postaLluna).toBeNull();
  });

  it('la vigília de la Lluna nova, la Lluna surt de matinada poc abans que el Sol', () => {
    const vigilia = nitAstronomica(BARCELONA, '2026-10-09');
    expect(vigilia.lluna.fase).toBe('nova');
    expect(vigilia.llunaSobreHoritzoALaPosta).toBe(false);
    expect(vigilia.sortidaLluna).not.toBeNull();
    expect(vigilia.postaLluna).toBeNull();
    expect(minuts(vigilia.sortidaLluna!, vigilia.sortidaSol)).toBeLessThan(30);
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

  it('a 66° N, quan el Sol només frega l’horitzó, la sortida ve després de la posta', () => {
    const polar = nitAstronomica({ lat: 66, lon: 18.96 }, '2026-06-03');
    expect(Date.parse(polar.sortidaSol)).toBeGreaterThan(Date.parse(polar.postaSol));
    expect(minuts(polar.postaSol, polar.sortidaSol)).toBeLessThan(180);
  });

  it.each(['14/10/2026', '2026-10-14T00:00:00Z', '2026-13-01', '2026-02-30', ''])(
    'rebutja la data invàlida %p',
    (data) => {
      expect(() => nitAstronomica(BARCELONA, data)).toThrow(RangeError);
    },
  );
});

import { calcularCalendari, METODE_CALCUL } from '../calendari';
import { generarSql } from '../calendari-cli';

describe('calendari astronòmic calculat (TG-107)', () => {
  const dades = calcularCalendari();

  test('fases noves i plenes de tot el període, sense quarts ni codis repetits', () => {
    const fases = dades.esdeveniments.filter((e) =>
      ['lluna-nova', 'lluna-plena', 'superlluna-plena'].includes(e.fenomen_codi),
    );
    expect(fases.filter((e) => e.fenomen_codi === 'lluna-nova')).toHaveLength(16);
    expect(fases.filter((e) => e.fenomen_codi !== 'lluna-nova')).toHaveLength(15);
    expect(new Set(dades.esdeveniments.map((e) => e.codi)).size).toBe(dades.esdeveniments.length);
    expect(dades.esdeveniments.every((e) => e.maxim >= e.inici && e.maxim <= e.fi)).toBe(true);
    for (const fase of fases) {
      expect(fase.codi).toMatch(/-\d{4}-\d{2}-\d{2}$/);
      expect(fase.precisio).toEqual({ inici: 'dia', fi: 'dia', maxim: 'segon' });
    }
    expect(
      dades.esdeveniments
        .filter((e) => e.fenomen_codi.startsWith('conjuncio-'))
        .every((e) => e.precisio.inici === 'hora' && e.precisio.fi === 'hora'),
    ).toBe(true);
  });

  test.each([
    [
      'superlluna-plena-2027-02-21',
      '2027-02-20T23:24:07Z',
      '2027-02-20T23:00:00Z',
      '2027-02-21T22:59:59Z',
    ],
    [
      'lluna-nova-2027-04-07',
      '2027-04-06T23:51:45Z',
      '2027-04-06T22:00:00Z',
      '2027-04-07T21:59:59Z',
    ],
    [
      'lluna-plena-2027-04-21',
      '2027-04-20T22:27:45Z',
      '2027-04-20T22:00:00Z',
      '2027-04-21T21:59:59Z',
    ],
    [
      'lluna-plena-2027-09-16',
      '2027-09-15T23:04:09Z',
      '2027-09-15T22:00:00Z',
      '2027-09-16T21:59:59Z',
    ],
  ])('fase %s al dia civil de Catalunya, no al dia UTC', (codi, maxim, inici, fi) => {
    expect(dades.esdeveniments.find((e) => e.codi === codi)).toMatchObject({
      codi,
      maxim,
      inici,
      fi,
    });
  });

  test('superllunes: distància per sota del llindar i sense lluna plena duplicada', () => {
    const superllunes = dades.esdeveniments.filter((e) => e.fenomen_codi === 'superlluna-plena');
    expect(superllunes.length).toBeGreaterThan(0);
    for (const event of superllunes) {
      expect(event.detall_calcul?.distancia_lluna_km).toBeLessThanOrEqual(
        event.detall_calcul?.llindar_superlluna_km ?? 0,
      );
      expect(
        dades.esdeveniments.some(
          (e) => e.fenomen_codi === 'lluna-plena' && e.maxim === event.maxim,
        ),
      ).toBe(false);
    }
    expect(superllunes.map((e) => e.codi)).toContain('superlluna-plena-2026-12-24');
    expect(superllunes.map((e) => e.codi)).toContain('superlluna-plena-2027-01-22');
    expect(dades.esdeveniments.map((e) => e.codi)).toContain('lluna-plena-2026-10-26');
    expect(superllunes.map((e) => e.codi)).not.toContain('superlluna-plena-2026-10-26');
  });

  test('aproximacions filtrades i procedència pròpia, no NASA/IMO', () => {
    const conjuncions = dades.esdeveniments.filter((e) => e.fenomen_codi.startsWith('conjuncio-'));
    expect(conjuncions.length).toBeGreaterThan(0);
    expect(conjuncions.every((e) => (e.detall_calcul?.separacio_graus ?? 99) <= 3)).toBe(true);
    expect(
      conjuncions.every((e) =>
        e.textos.ca.nota_visibilitat.includes('franja inici-fi és orientativa'),
      ),
    ).toBe(true);
    expect(dades.esdeveniments.every((e) => e.metode_calcul === METODE_CALCUL)).toBe(true);
    expect(generarSql(dades)).toContain('metode_calcul');
    expect(generarSql(dades)).not.toContain("'NASA'");
    expect(generarSql(dades)).toContain('delete from public.esdeveniments_astronomics');
    expect(generarSql(dades)).toContain(`where metode_calcul = '${METODE_CALCUL}'`);
    expect(generarSql(dades)).toContain(
      'excluded.rellevant_catalunya, excluded.rellevancia, excluded.dificultat_observacio',
    );
  });

  test('període reduït i dates invàlides', () => {
    const octubre = calcularCalendari('2026-10-01', '2026-10-31');
    expect(
      octubre.esdeveniments.every(
        (e) => e.maxim >= '2026-10-01' && e.maxim <= '2026-10-31T23:59:59Z',
      ),
    ).toBe(true);
    expect(() => calcularCalendari('2027-01-01', '2026-01-01')).toThrow(RangeError);
  });
});

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
  });

  test('aproximacions filtrades i procedència pròpia, no NASA/IMO', () => {
    const conjuncions = dades.esdeveniments.filter((e) => e.fenomen_codi.startsWith('conjuncio-'));
    expect(conjuncions.length).toBeGreaterThan(0);
    expect(conjuncions.every((e) => (e.detall_calcul?.separacio_graus ?? 99) <= 3)).toBe(true);
    expect(dades.esdeveniments.every((e) => e.metode_calcul === METODE_CALCUL)).toBe(true);
    expect(generarSql(dades)).toContain('metode_calcul');
    expect(generarSql(dades)).not.toContain("'NASA'");
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

import { diaUtc, franjaUtc, horaLocalAUtc } from '../franja';

const iso = (d: Date) => d.toISOString();

describe('diaUtc', () => {
  it.each(['2026-10-21', '2028-02-29'])('%s és una data vàlida', (data) => {
    expect(new Date(diaUtc(data)).toISOString().slice(0, 10)).toBe(data);
  });

  it.each(['2026-02-30', '2026-13-01', '21-10-2026', '2026-10-21T22:00', ''])(
    '%s no és una data vàlida',
    (data) => {
      expect(diaUtc(data)).toBeNaN();
    },
  );
});

describe('horaLocalAUtc', () => {
  it("a l'estiu (CEST) resta dues hores", () => {
    expect(iso(horaLocalAUtc('2026-07-15', 22))).toBe('2026-07-15T20:00:00.000Z');
  });

  it("a l'hivern (CET) en resta una", () => {
    expect(iso(horaLocalAUtc('2026-12-15', 22))).toBe('2026-12-15T21:00:00.000Z');
  });

  it('a mitjanit queda al dia anterior en UTC', () => {
    expect(iso(horaLocalAUtc('2026-12-16', 0))).toBe('2026-12-15T23:00:00.000Z');
  });

  it('les 02:00 del canvi de primavera no existeixen: passa a les 03:00', () => {
    expect(iso(horaLocalAUtc('2026-03-29', 2))).toBe('2026-03-29T01:00:00.000Z');
  });

  it('les 02:00 del canvi de tardor es repeteixen: és la segona', () => {
    expect(iso(horaLocalAUtc('2026-10-25', 2))).toBe('2026-10-25T01:00:00.000Z');
  });
});

describe('franjaUtc', () => {
  it('una franja que comença de matinada és la de després del vespre de data', () => {
    const f = franjaUtc('2026-10-21', 1, 5);
    expect(iso(f.desDe)).toBe('2026-10-21T23:00:00.000Z'); // 22/10 01:00 CEST
    expect(iso(f.finsA)).toBe('2026-10-22T03:00:00.000Z');
  });

  it('de 00 a 06 també és la matinada de l’endemà', () => {
    const f = franjaUtc('2026-12-15', 0, 6);
    expect(iso(f.desDe)).toBe('2026-12-15T23:00:00.000Z'); // 16/12 00:00 CET
    expect(iso(f.finsA)).toBe('2026-12-16T05:00:00.000Z');
  });

  it("la nit talla a les 12: de 10 a 14 és el matí de l'endemà", () => {
    const f = franjaUtc('2026-12-15', 10, 14);
    expect(iso(f.desDe)).toBe('2026-12-16T09:00:00.000Z');
    expect(iso(f.finsA)).toBe('2026-12-16T13:00:00.000Z');
  });

  it('de 12 a 23 és el mateix dia', () => {
    const f = franjaUtc('2026-12-15', 12, 23);
    expect(iso(f.desDe)).toBe('2026-12-15T11:00:00.000Z');
    expect(iso(f.finsA)).toBe('2026-12-15T22:00:00.000Z');
  });

  it("de 05 a 02 comença la matinada de l'endemà i acaba l'endemà d'aquesta", () => {
    const f = franjaUtc('2026-12-15', 5, 2);
    expect(iso(f.desDe)).toBe('2026-12-16T04:00:00.000Z');
    expect(iso(f.finsA)).toBe('2026-12-17T01:00:00.000Z');
  });

  it('si finsA < desDe, la franja acaba l’endemà', () => {
    const f = franjaUtc('2026-12-15', 22, 6);
    expect(iso(f.desDe)).toBe('2026-12-15T21:00:00.000Z');
    expect(iso(f.finsA)).toBe('2026-12-16T05:00:00.000Z');
  });

  it('si finsA > desDe, és el mateix dia', () => {
    const f = franjaUtc('2026-07-15', 19, 23);
    expect(iso(f.desDe)).toBe('2026-07-15T17:00:00.000Z');
    expect(iso(f.finsA)).toBe('2026-07-15T21:00:00.000Z');
  });

  it("una nit amb el canvi d'hora de tardor (22–06) té 9 hores", () => {
    const f = franjaUtc('2026-10-24', 22, 6);
    expect((f.finsA.getTime() - f.desDe.getTime()) / 3_600_000).toBe(9);
  });

  it("una nit amb el canvi d'hora de primavera (22–06) té 7 hores", () => {
    const f = franjaUtc('2026-03-28', 22, 6);
    expect((f.finsA.getTime() - f.desDe.getTime()) / 3_600_000).toBe(7);
  });

  it("canvia de mes i d'any", () => {
    expect(iso(franjaUtc('2026-12-31', 23, 1).finsA)).toBe('2027-01-01T00:00:00.000Z');
  });
});

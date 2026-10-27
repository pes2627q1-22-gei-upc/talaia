import { headingDelta, smoothHeading } from '../headingFilter';

describe('headingDelta', () => {
  it.each([
    [10, 30, 20],
    [350, 10, 20],
    [10, 350, -20],
    [0, 180, -180],
    [720, 5, 5],
  ])('de %s a %s → %s', (a, b, delta) => {
    expect(headingDelta(a, b)).toBe(delta);
  });
});

describe('smoothHeading', () => {
  it('la primera lectura passa tal qual', () => {
    expect(smoothHeading(null, 123, 0)).toBe(123);
  });

  it('una lectura immediata no mou res i una de fa molt arriba sencera', () => {
    expect(smoothHeading(100, 140, 0)).toBe(100);
    expect(smoothHeading(100, 140, 10_000)).toBeCloseTo(140);
  });

  it('esmorteeix un salt de soroll', () => {
    const value = smoothHeading(100, 130, 16);
    expect(value).toBeGreaterThan(100);
    expect(value).toBeLessThan(105);
  });

  it('passa pel nord per la banda curta, sense donar la volta', () => {
    const value = smoothHeading(355, 5, 150);
    expect(value === 0 || value > 355 || value < 5).toBe(true);
    expect(Math.abs(headingDelta(355, value))).toBeLessThan(10);
  });
});

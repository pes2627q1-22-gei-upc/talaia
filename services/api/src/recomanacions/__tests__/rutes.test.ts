import { rutesEnLiniaRecta } from '../rutes';

describe('rutesEnLiniaRecta', () => {
  it.each([
    [30, 23.1],
    [60, 46.2],
    [150, 115.4],
    [240, 184.6],
  ])('%i minuts → radi de %f km (60 km/h, desviament ×1,3)', (minuts, km) => {
    expect(rutesEnLiniaRecta.radiKm(minuts)).toBe(km);
  });

  it('un punt al límit del radi queda a uns tempsMaxim minuts', () => {
    expect(rutesEnLiniaRecta.minuts(rutesEnLiniaRecta.radiKm(150))).toBe(150);
  });

  it.each([
    [0, 0],
    [10, 13],
    [46.2, 60],
  ])('%f km → %i minuts', (km, minuts) => {
    expect(rutesEnLiniaRecta.minuts(km)).toBe(minuts);
  });
});

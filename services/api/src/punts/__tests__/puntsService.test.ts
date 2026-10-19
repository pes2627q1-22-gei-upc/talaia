import type { IndexHora } from '@talaia/shared';

import { iniciHora, splitIndexHores } from '../puntsService';

const fila = (hora: string): IndexHora => ({
  hora,
  valor: 50,
  franja: 'jus',
  factors: { nuvols: 1, sol: 1, foscor: 0.6, lluna: 0.5 },
  foscorEstimada: true,
});

describe('iniciHora', () => {
  it("arrodoneix cap avall a l'hora en punt, en UTC", () => {
    expect(iniciHora(new Date('2026-10-18T21:59:59.999Z')).toISOString()).toBe(
      '2026-10-18T21:00:00.000Z',
    );
    expect(iniciHora(new Date('2026-10-18T22:00:00.000Z')).toISOString()).toBe(
      '2026-10-18T22:00:00.000Z',
    );
  });
});

describe('splitIndexHores', () => {
  const horaActual = new Date('2026-10-18T21:00:00.000Z');

  it("separa l'hora en curs de les següents", () => {
    const files = [
      '2026-10-18T21:00:00.000Z',
      '2026-10-18T22:00:00.000Z',
      '2026-10-18T23:00:00.000Z',
    ].map(fila);
    expect(splitIndexHores(files, horaActual)).toEqual({
      actual: files[0],
      properesHores: [files[1], files[2]],
    });
  });

  it("sense l'hora en curs calculada, actual és null però les següents hi són", () => {
    const files = [fila('2026-10-18T22:00:00.000Z')];
    expect(splitIndexHores(files, horaActual)).toEqual({ actual: null, properesHores: files });
  });

  it('sense cap fila: actual null i cap hora següent', () => {
    expect(splitIndexHores([], horaActual)).toEqual({ actual: null, properesHores: [] });
  });
});

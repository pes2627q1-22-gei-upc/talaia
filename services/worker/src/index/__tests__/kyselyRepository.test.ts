import type { IndexHora } from '@talaia/shared';

import { fakeDb } from '../../testing/fakeDb';
import { createKyselyIndexRepository } from '../repository';

const HORA = '2026-11-20T22:00:00.000Z';

describe('repositori de l’índex amb Kysely (TG-184, ADR-0037)', () => {
  it('desa la versió i si la humitat és corregida, amb els valors per defecte de la v1', async () => {
    const { db, queries } = fakeDb();
    const v2: IndexHora = {
      hora: HORA,
      valor: 86,
      franja: 'ras',
      factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1, humitat: 0.7 },
      foscorEstimada: false,
      versio: 2,
      humitatCorregida: true,
    };
    const v1: IndexHora = {
      ...v2,
      hora: '2026-11-20T23:00:00.000Z',
      versio: undefined,
      humitatCorregida: undefined,
    };

    await createKyselyIndexRepository(db).desaIndexs('p1', [v2, v1]);

    expect(queries[0]?.sql).toContain('"versio"');
    expect(queries[0]?.sql).toContain('"humitat_corregida"');
    // Per fila: punt, hora, valor, franja, factors, foscor_estimada, versio, humitat_corregida.
    expect(queries[0]?.parameters).toEqual(expect.arrayContaining([2, true, 1, false]));
  });

  it('indexsDe torna la versió i la humitat corregida de cada hora', async () => {
    const { db } = fakeDb([
      {
        hora: new Date(HORA),
        valor: 86,
        franja: 'ras',
        factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1, humitat: 0.7 },
        foscor_estimada: false,
        versio: 2,
        humitat_corregida: true,
      },
    ]);

    const hores = await createKyselyIndexRepository(db).indexsDe('p1');

    expect(hores).toEqual([
      {
        hora: HORA,
        valor: 86,
        franja: 'ras',
        factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1, humitat: 0.7 },
        foscorEstimada: false,
        versio: 2,
        humitatCorregida: true,
      },
    ]);
  });
});

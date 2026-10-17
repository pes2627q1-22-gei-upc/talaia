import type { IndexHora } from '@talaia/shared';

import { createInMemoryIndexRepository } from '../repository';

const index = (hora: string, valor: number): IndexHora => ({
  hora,
  valor,
  franja: valor >= 70 ? 'ras' : valor >= 40 ? 'jus' : 'tap',
  factors: { nuvols: 1, sol: 1, foscor: 0.6, lluna: 1 },
  foscorEstimada: true,
});

describe('repositori de l’índex', () => {
  it('desa una fila per punt i hora: recalcular una hora la substitueix', async () => {
    const repo = createInMemoryIndexRepository();
    await repo.desaIndexs('p1', [
      index('2026-10-16T22:00:00.000Z', 80),
      index('2026-10-16T21:00:00.000Z', 50),
    ]);
    await repo.desaIndexs('p1', [index('2026-10-16T22:00:00.000Z', 30)]);
    await repo.desaIndexs('p2', [index('2026-10-16T22:00:00.000Z', 90)]);

    const p1 = await repo.indexsDe('p1');
    expect(p1.map((i) => [i.hora, i.valor])).toEqual([
      ['2026-10-16T21:00:00.000Z', 50],
      ['2026-10-16T22:00:00.000Z', 30],
    ]);
    expect(await repo.indexsDe('p3')).toEqual([]);
  });
});

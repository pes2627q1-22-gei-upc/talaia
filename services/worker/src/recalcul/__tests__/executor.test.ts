import { createExecutor } from '../executor';
import type { ResumRecalcul } from '../recalcul';

const RESUM: ResumRecalcul = {
  iniciadaEl: new Date('2026-10-16T21:05:00.000Z'),
  acabadaEl: new Date('2026-10-16T21:05:02.000Z'),
  estat: 'ok',
  punts: 32,
  hores: 2720,
};

/** Un recàlcul que no acaba fins que el test el deixa acabar. */
function recalculControlat() {
  const pendents: Array<{ resol: () => void; falla: (e: Error) => void; senyal: AbortSignal }> = [];
  const recalcula = jest.fn(
    (senyal: AbortSignal) =>
      new Promise<ResumRecalcul>((resolve, reject) => {
        pendents.push({ resol: () => resolve(RESUM), falla: reject, senyal });
      }),
  );
  return { recalcula, pendents };
}

describe('createExecutor', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("se salta una execució si l'anterior encara no ha acabat", async () => {
    const { recalcula, pendents } = recalculControlat();
    const executor = createExecutor(recalcula);

    const primera = executor.executa('arrencada');
    void executor.executa('hora');
    expect(recalcula).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('se salta'));

    pendents[0]?.resol();
    await primera;
    void executor.executa('hora');
    expect(recalcula).toHaveBeenCalledTimes(2);
  });

  it("un recàlcul que falla no propaga l'error i deixa fer el següent", async () => {
    const { recalcula, pendents } = recalculControlat();
    const executor = createExecutor(recalcula);

    const primera = executor.executa('hora');
    pendents[0]?.falla(new Error('Open-Meteo 503'));
    await expect(primera).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      '[worker] hora: el recàlcul ha fallat',
      expect.any(Error),
    );

    void executor.executa('hora');
    expect(recalcula).toHaveBeenCalledTimes(2);
  });

  it("aturar activa el senyal, espera l'execució en curs i no en deixa començar cap més", async () => {
    const { recalcula, pendents } = recalculControlat();
    const executor = createExecutor(recalcula);
    void executor.executa('hora');

    let aturat = false;
    const aturant = executor.atura().then(() => {
      aturat = true;
    });
    expect(pendents[0]?.senyal.aborted).toBe(true);
    await Promise.resolve();
    expect(aturat).toBe(false);

    pendents[0]?.resol();
    await aturant;
    expect(aturat).toBe(true);

    await executor.executa('hora');
    expect(recalcula).toHaveBeenCalledTimes(1);
  });
});

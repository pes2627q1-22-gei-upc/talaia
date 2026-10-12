import type { PrevisioMeteoPunt } from '@talaia/shared';

/**
 * Port de persistència de les previsions. La implementació amb Kysely (`@talaia/db`, ADR-0013)
 * arriba quan existeixi la taula de punts (TG-86) i es pugui escriure la migració de previsions;
 * mentrestant, la de memòria serveix per als tests i per a la CLI.
 */
export type PrevisioMeteoRepository = {
  /** Substitueix la previsió de cada punt per la nova. */
  desaPrevisions(previsions: PrevisioMeteoPunt[]): Promise<void>;
  previsioDe(puntId: string): Promise<PrevisioMeteoPunt | undefined>;
};

export type InMemoryPrevisioMeteoRepository = PrevisioMeteoRepository & {
  totes(): PrevisioMeteoPunt[];
};

export function createInMemoryPrevisioMeteoRepository(): InMemoryPrevisioMeteoRepository {
  const perPunt = new Map<string, PrevisioMeteoPunt>();
  return {
    async desaPrevisions(previsions) {
      for (const previsio of previsions) perPunt.set(previsio.puntId, previsio);
    },
    async previsioDe(puntId) {
      return perPunt.get(puntId);
    },
    totes() {
      return [...perPunt.values()];
    },
  };
}

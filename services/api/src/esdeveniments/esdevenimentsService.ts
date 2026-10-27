import type { Esdeveniment, EsdevenimentsResponse, TipusFenomen } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { intervalCatala } from './dates';
import type {
  EsdevenimentsRepository,
  FilaEsdeveniment,
  PuntReferencia,
} from './esdevenimentsRepository';

type TextosFenomen = { ca?: { nom?: unknown; descripcio?: unknown } };
// CamelCasePlugin de Kysely converteix també recursivament les claus dels JSONB.
type TextosEsdeveniment = { ca?: { notaVisibilitat?: unknown } };

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mapEsdeveniment(fila: FilaEsdeveniment, ubicacio: PuntReferencia): Esdeveniment {
  const fenomen = fila.textosFenomen as TextosFenomen;
  const esdeveniment = fila.textosEsdeveniment as TextosEsdeveniment;
  const nom = text(fenomen?.ca?.nom);
  const descripcioBase = text(fenomen?.ca?.descripcio);
  const nota = text(esdeveniment?.ca?.notaVisibilitat);
  const font = fila.organitzacio ?? fila.metodeCalcul;
  if (!nom || !descripcioBase || !font) {
    console.error('[esdeveniments] dades incompletes', fila.codi);
    throw new ApiError(
      500,
      'invalid_event_data',
      `Dades incompletes de l'esdeveniment ${fila.codi}`,
    );
  }
  return {
    id: fila.codi,
    tipus: fila.tipus as TipusFenomen,
    nom,
    inici: fila.inici.toISOString(),
    fi: fila.fi.toISOString(),
    maxim: fila.maxim?.toISOString() ?? null,
    // Les notes de les conjuncions provenen de càlculs fets des del Montseny,
    // però l'ubicació pública és Àger. No barregem els dos llocs en una fitxa.
    descripcio: nota && fila.tipus !== 'conjuncio' ? `${descripcioBase} ${nota}` : descripcioBase,
    ubicacio,
    font,
  };
}

export type EsdevenimentsService = {
  list(desDe: string, finsA: string, tipus?: TipusFenomen): Promise<EsdevenimentsResponse>;
};

export function createEsdevenimentsService(
  repository: EsdevenimentsRepository,
): EsdevenimentsService {
  return {
    async list(desDe, finsA, tipus) {
      const { inici, fi } = intervalCatala(desDe, finsA);
      let files: FilaEsdeveniment[];
      let ubicacio: PuntReferencia | undefined;
      try {
        [files, ubicacio] = await Promise.all([
          repository.list(inici, fi, tipus),
          repository.puntReferencia(),
        ]);
      } catch (error) {
        console.error('[esdeveniments] no es pot consultar la base de dades', error);
        throw new ApiError(
          503,
          'database_unavailable',
          'Ara mateix no es pot llegir el calendari astronòmic',
        );
      }
      if (!ubicacio) {
        throw new ApiError(
          503,
          'reference_point_unavailable',
          'Falta el punt oficial de referència del calendari',
        );
      }
      return { data: files.map((fila) => mapEsdeveniment(fila, ubicacio)) };
    },
  };
}

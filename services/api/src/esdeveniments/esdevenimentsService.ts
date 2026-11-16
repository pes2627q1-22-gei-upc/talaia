import type {
  Esdeveniment,
  EsdevenimentDetall,
  EsdevenimentsResponse,
  PrecisioTemporal,
  TipusFenomen,
} from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { idiomesPreferits, localized, type Idioma } from '../idioma';
import { puntLocalitzat } from '../punts/localitzacio';
import { intervalCatala } from './dates';
import type {
  EsdevenimentsRepository,
  FilaEsdeveniment,
  PuntReferencia,
} from './esdevenimentsRepository';

type TextosFenomen = Partial<
  Record<Idioma, { nom?: unknown; descripcio?: unknown; consellGeneral?: unknown }>
>;
// CamelCasePlugin de Kysely converteix també recursivament les claus dels JSONB.
type TextosEsdeveniment = Partial<
  Record<Idioma, { notaVisibilitat?: unknown; consellObservacio?: unknown }>
>;

function invalidData(codi: string): never {
  console.error('[esdeveniments] dades incompletes', codi);
  throw new ApiError(500, 'invalid_event_data', `Dades incompletes de l'esdeveniment ${codi}`);
}

function temporalPrecision(value: unknown): value is PrecisioTemporal {
  return value === 'dia' || value === 'hora' || value === 'minut' || value === 'segon';
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mapEsdeveniment(
  fila: FilaEsdeveniment,
  ubicacio: PuntReferencia,
  acceptLanguage?: string,
): Esdeveniment {
  const languages = idiomesPreferits(acceptLanguage);
  const fenomen = fila.textosFenomen as TextosFenomen;
  const esdeveniment = fila.textosEsdeveniment as TextosEsdeveniment;
  const nom = text(localized(fenomen, languages)?.nom);
  const descripcioBase = text(localized(fenomen, languages)?.descripcio);
  const nota = text(localized(esdeveniment, languages)?.notaVisibilitat);
  const font = fila.organitzacio ?? fila.metodeCalcul;
  if (!nom || !descripcioBase || !font) {
    invalidData(fila.codi);
  }
  return {
    id: fila.codi,
    tipus: fila.tipus as TipusFenomen,
    nom,
    inici: fila.inici.toISOString(),
    fi: fila.fi.toISOString(),
    maxim: fila.maxim?.toISOString() ?? null,
    // Les notes de les conjuncions provenen de càlculs fets des del Montseny,
    // però l'ubicació pública és Àger. No les afegim a la descripció genèrica;
    // el detall les identifica separadament com a particularitat de l'ocurrència.
    descripcio: nota && fila.tipus !== 'conjuncio' ? `${descripcioBase} ${nota}` : descripcioBase,
    ubicacio: puntLocalitzat(ubicacio, acceptLanguage),
    font,
  };
}

function mapDetall(
  fila: FilaEsdeveniment,
  ubicacio: PuntReferencia,
  acceptLanguage?: string,
): EsdevenimentDetall {
  const languages = idiomesPreferits(acceptLanguage);
  const fenomen = fila.textosFenomen as TextosFenomen;
  const esdeveniment = fila.textosEsdeveniment as TextosEsdeveniment;
  const textosFenomen = localized(fenomen, languages);
  const textosEsdeveniment = localized(esdeveniment, languages);
  const translatedRow: FilaEsdeveniment = {
    ...fila,
    textosFenomen: { ca: textosFenomen },
    textosEsdeveniment: { ca: textosEsdeveniment },
  };
  const event = mapEsdeveniment(translatedRow, ubicacio, acceptLanguage);
  const precisio = fila.precisio as Record<string, unknown> | null;
  const particularitat = text(textosEsdeveniment?.notaVisibilitat);
  const observacioGeneral = text(textosFenomen?.consellGeneral);
  const observacioEsdeveniment = text(textosEsdeveniment?.consellObservacio);
  const explicacioFenomen = text(textosFenomen?.descripcio);
  const precisioInici = precisio?.inici;
  const precisioFi = precisio?.fi;
  const precisioMaxim = precisio?.maxim;
  if (
    !explicacioFenomen ||
    !particularitat ||
    !observacioGeneral ||
    !observacioEsdeveniment ||
    !temporalPrecision(precisioInici) ||
    !temporalPrecision(precisioFi) ||
    (fila.maxim === null ? precisioMaxim !== null : !temporalPrecision(precisioMaxim))
  )
    invalidData(fila.codi);
  return {
    ...event,
    horari: {
      inici: event.inici,
      maxim: event.maxim,
      fi: event.fi,
      precisio: {
        inici: precisioInici,
        maxim: temporalPrecision(precisioMaxim) ? precisioMaxim : null,
        fi: precisioFi,
      },
    },
    explicacio: {
      fenomen: explicacioFenomen,
      particularitat,
      observacioGeneral,
      observacioEsdeveniment,
    },
  };
}

export type EsdevenimentsService = {
  list(
    desDe: string,
    finsA: string,
    tipus?: TipusFenomen,
    acceptLanguage?: string,
  ): Promise<EsdevenimentsResponse>;
  getById(id: string, acceptLanguage?: string): Promise<EsdevenimentDetall>;
};

export function createEsdevenimentsService(
  repository: EsdevenimentsRepository,
): EsdevenimentsService {
  return {
    async getById(id, acceptLanguage) {
      let fila: FilaEsdeveniment | undefined;
      let ubicacio: PuntReferencia | undefined;
      try {
        [fila, ubicacio] = await Promise.all([
          repository.findPublicById(id),
          repository.puntReferencia(),
        ]);
      } catch (error) {
        console.error(`[esdeveniments] no es pot consultar l'esdeveniment ${id}`, error);
        throw new ApiError(
          503,
          'database_unavailable',
          'Ara mateix no es pot llegir el calendari astronòmic',
        );
      }
      if (!fila) {
        throw new ApiError(
          404,
          'event_not_found',
          `No hi ha cap esdeveniment publicable amb id ${id}`,
        );
      }
      if (!ubicacio) {
        throw new ApiError(
          503,
          'reference_point_unavailable',
          'Falta el punt oficial de referència del calendari',
        );
      }
      return mapDetall(fila, ubicacio, acceptLanguage);
    },
    async list(desDe, finsA, tipus, acceptLanguage) {
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
      return { data: files.map((fila) => mapEsdeveniment(fila, ubicacio, acceptLanguage)) };
    },
  };
}

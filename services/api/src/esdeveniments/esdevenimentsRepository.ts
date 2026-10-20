import { lat, lon, type createDb } from '@talaia/db';
import type { TipusFenomen } from '@talaia/shared';
import { TIPUS_FENOMEN } from './tipus';

type Db = ReturnType<typeof createDb>;

export type FilaEsdeveniment = {
  codi: string;
  tipus: string;
  inici: Date;
  fi: Date;
  maxim: Date | null;
  textosFenomen: unknown;
  textosEsdeveniment: unknown;
  organitzacio: 'IMO' | 'NASA' | null;
  metodeCalcul: string | null;
};

export type PuntReferencia = {
  nom: string;
  latitud: number;
  longitud: number;
};

export type EsdevenimentsRepository = {
  list(inici: Date, fi: Date, tipus?: TipusFenomen): Promise<FilaEsdeveniment[]>;
  puntReferencia(): Promise<PuntReferencia | undefined>;
};

/** Consultes del calendari i del punt oficial (ADR-0013 i ADR-0026). */
export function createEsdevenimentsRepository(db: Db): EsdevenimentsRepository {
  return {
    async list(inici, fi, tipus) {
      let query = db
        .selectFrom('esdevenimentsAstronomics as e')
        .innerJoin('fenomensAstronomics as f', 'f.codi', 'e.fenomenCodi')
        .leftJoin('fontsAstronomiques as font', 'font.codi', 'e.fontCodi')
        .select([
          'e.codi',
          'f.tipusCodi as tipus',
          'e.inici',
          'e.fi',
          'e.maxim',
          'f.textos as textosFenomen',
          'e.textos as textosEsdeveniment',
          'font.organitzacio',
          'e.metodeCalcul',
        ])
        .where('e.inici', '<', fi)
        .where('e.fi', '>', inici)
        .where('e.rellevantCatalunya', '=', true)
        .where('f.publicableCalendari', '=', true)
        // La taula interna és extensible; el contracte públic només exposa els tipus acordats.
        .where('f.tipusCodi', 'in', [...TIPUS_FENOMEN]);
      if (tipus) query = query.where('f.tipusCodi', '=', tipus);
      return query.orderBy('e.inici').orderBy('e.codi').execute();
    },
    async puntReferencia() {
      const fila = await db
        .selectFrom('puntsObservacio as p')
        .select((eb) => [
          'p.nom',
          lon(eb.ref('p.ubicacio')).as('longitud'),
          lat(eb.ref('p.ubicacio')).as('latitud'),
        ])
        .where('p.slug', '=', 'centre-observacio-univers')
        .where('p.origen', '=', 'OFICIAL')
        .where('p.estat', '=', 'PUBLICAT')
        .executeTakeFirst();
      return fila ?? undefined;
    },
  };
}

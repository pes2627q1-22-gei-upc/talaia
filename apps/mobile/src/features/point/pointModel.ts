import type { PuntFitxa } from '@talaia/shared';

/** Dades que necessita la fitxa mòbil després d'adaptar `GET /punts/{id}`. */
export type PointDetailModel = Omit<PuntFitxa, 'index'> & {
  indexActual: PuntFitxa['index']['actual'];
  properesHores: PuntFitxa['index']['properesHores'];
};

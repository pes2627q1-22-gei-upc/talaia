import type { PuntFitxa } from '@talaia/shared';

/** Dades que necessita la fitxa mòbil després d'adaptar `GET /punts/{id}`. */
export type PointDetailModel = Omit<PuntFitxa, 'index'> & {
  indexActual: PuntFitxa['index']['actual'];
  properesHores: PuntFitxa['index']['properesHores'];
};

/**
 * Hores sempre amb dues xifres (`04:00`, `07`). Hermes formata l'hora sense el zero encara que es
 * demani `hour: '2-digit'`, i la fitxa quedava amb `4:00` al costat de `05:00`.
 */
export const twoDigitHours = (text: string) =>
  text.replace(
    /(^|\D)(\d)(?=:\d\d|$)/g,
    (_, before: string, digit: string) => `${before}0${digit}`,
  );

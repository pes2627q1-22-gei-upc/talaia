import type { ObjectiuObservacio } from './recomanacions';

/**
 * Una alerta de l'usuari autenticat (HU16, taula `alertes`, TG-145): avisa quan algun punt a
 * `distanciaMaxKm` o menys de l'`origen` arriba a `indexMinim` per a l'`objectiu`. Només la veu
 * qui l'ha creat. Dates en ISO 8601.
 */
export type Alerta = {
  id: string;
  /** El fenomen: el mateix selector que «Què vols veure?». */
  objectiu: ObjectiuObservacio;
  /** D'on es mesura la distància, en graus WGS84. */
  origen: { lat: number; lon: number };
  /** Radi en línia recta des de l'origen, en km (enter, 1–200). */
  distanciaMaxKm: number;
  /** Índex de visibilitat mínim per avisar (enter, 0–100). */
  indexMinim: number;
  /** Una alerta desactivada no notifica (TG-147). Una de nova sempre és activa. */
  activa: boolean;
  dataCreacio: string;
  dataActualitzacio: string;
};

/** Cos de `POST /api/v1/alertes`. No porta cap usuari: l'API el treu del JWT. */
export type AlertaNova = Pick<Alerta, 'objectiu' | 'origen' | 'distanciaMaxKm' | 'indexMinim'>;

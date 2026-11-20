// Les peces de l'índex de visibilitat que comparteixen el worker (punts del catàleg, cada hora) i
// l'API (qualsevol ubicació, al moment): ADR-0031.
export {
  ALCADA_CREPUSCLE,
  ALCADA_SOL_HORITZO,
  efemeridesHora,
  efemeridesHores,
  estatLluna,
  faseLunar,
  franjaCrepuscle,
  nitAstronomica,
  nomFaseLunar,
  posicioSol,
  type LlocObservacio,
} from './astronomia';
export {
  FORMULA_V1,
  FORMULA_V2,
  VERSIO_INDEX,
  calculaIndex,
  calculaIndexHores,
  factorFoscor,
  factorHumitat,
  factorLluna,
  factorNuvols,
  factorSol,
  franjaDe,
  humitatAmbBiaix,
  type EntradaIndex,
  type OpcionsIndex,
} from './formula';
export { GRAUS_PERFIL, alcadaAparent, amagatPelRelleu, horitzoA } from './horitzo';
export {
  DIES_PREVISIO_PER_DEFECTE,
  LLOCS_PER_PETICIO_PER_DEFECTE,
  OpenMeteoError,
  TIMEOUT_MS_PER_DEFECTE,
  UNITATS,
  UNITATS_ESPERADES,
  VARIABLES_HORARIES,
  createOpenMeteoClient,
  toHores,
  type Coordenades,
  type OpenMeteoClient,
  type OpenMeteoClientOptions,
} from './openMeteo';

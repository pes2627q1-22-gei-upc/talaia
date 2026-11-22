/**
 * Perfil d'horitzó d'un lloc (ADR-0022) aplicat a un astre: si el relleu el tapa (índex v2,
 * ADR-0038). Codi pur, sense xarxa ni base de dades.
 *
 * El perfil (`punts_observacio.horitzo`) són 360 alçades **aparents** en graus, una per grau
 * d'azimut geogràfic: la posició 0 és el nord i la 90, l'est. Per comparar-hi un astre cal la
 * seva alçada aparent, la geomètrica d'Astronomy Engine més la refracció atmosfèrica.
 */
import type { PosicioAstre } from '@talaia/shared';
import { Refraction } from 'astronomy-engine';

/** Valors d'un perfil d'horitzó: un per grau d'azimut. */
export const GRAUS_PERFIL = 360;

/**
 * Alçada aparent d'un astre a partir de la geomètrica, en graus: hi suma la refracció
 * atmosfèrica estàndard (`Refraction('normal')` d'Astronomy Engine: 0,48° a l'horitzó, 0,09° a
 * 10°, gairebé res al zenit). Per sota de −1° la refracció es fa servir la de −1° i decreix fins al
 * nadir, com a la llibreria.
 */
export function alcadaAparent(alcadaGeometrica: number): number {
  if (!Number.isFinite(alcadaGeometrica) || alcadaGeometrica < -90 || alcadaGeometrica > 90) {
    throw new RangeError(
      `alcadaGeometrica ha de ser un nombre entre −90 i 90 (rebut: ${alcadaGeometrica})`,
    );
  }
  return alcadaGeometrica + Refraction('normal', alcadaGeometrica);
}

/**
 * Alçada de l'horitzó a un azimut (graus, 0 = N): interpolació lineal entre els dos graus enters
 * del perfil. Del 359 es passa al 0, i qualsevol azimut es porta a [0, 360).
 */
export function horitzoA(perfil: readonly number[], azimut: number): number {
  if (perfil.length !== GRAUS_PERFIL) {
    throw new RangeError(
      `El perfil d'horitzó ha de tenir ${GRAUS_PERFIL} valors (rebuts: ${perfil.length})`,
    );
  }
  if (!Number.isFinite(azimut)) {
    throw new RangeError(`azimut ha de ser un nombre (rebut: ${azimut})`);
  }
  const graus = ((azimut % GRAUS_PERFIL) + GRAUS_PERFIL) % GRAUS_PERFIL;
  const i = Math.floor(graus);
  const fraccio = graus - i;
  // `i` és de 0 a 359 i la longitud ja s'ha comprovat: els `?? 0` només tipen l'accés.
  const abans = perfil[i] ?? 0;
  const despres = perfil[(i + 1) % GRAUS_PERFIL] ?? 0;
  return abans + (despres - abans) * fraccio;
}

/**
 * Si el relleu tapa un astre que és sobre l'horitzó astronòmic: alçada geomètrica > 0 i alçada
 * aparent ≤ horitzó a l'azimut. Sense perfil (`null`: punts de la comunitat, ubicacions
 * arbitràries), mai. Un astre sota l'horitzó astronòmic no és «amagat pel relleu»: ja és post.
 */
export function amagatPelRelleu(posicio: PosicioAstre, perfil: readonly number[] | null): boolean {
  if (perfil === null || posicio.alcada <= 0) return false;
  return alcadaAparent(posicio.alcada) <= horitzoA(perfil, posicio.azimut);
}

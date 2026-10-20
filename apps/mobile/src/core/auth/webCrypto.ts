import * as Crypto from 'expo-crypto';

type Digest = (algorithm: string, data: BufferSource) => Promise<ArrayBuffer>;
type WebCrypto = {
  getRandomValues?: typeof Crypto.getRandomValues;
  subtle?: { digest?: Digest };
};

const digest: Digest = (algorithm, data) =>
  Crypto.digest(algorithm as Crypto.CryptoDigestAlgorithm, data);

/**
 * Supabase fa el PKCE amb `crypto.getRandomValues` i `crypto.subtle.digest`, que React Native no
 * porta. Sense ells, el verificador surt de `Math.random` i el mètode passa a `plain` (TG-249).
 * Les dues funcions vénen d'`expo-crypto`, que és a Expo Go.
 *
 * Només s'hi afegeix el que falta: on `crypto` ja existeix (el navegador, Hermes), és una propietat
 * només de lectura i no es pot substituir.
 */
export function installWebCrypto(target: { crypto?: unknown } = globalThis) {
  const existing = target.crypto as WebCrypto | undefined;
  if (!existing) {
    Object.defineProperty(target, 'crypto', {
      value: { getRandomValues: Crypto.getRandomValues, subtle: { digest } },
      configurable: true,
    });
    return;
  }
  if (typeof existing.getRandomValues !== 'function') {
    Object.defineProperty(existing, 'getRandomValues', {
      value: Crypto.getRandomValues,
      configurable: true,
    });
  }
  if (typeof existing.subtle?.digest !== 'function') {
    // `subtle` sol ser un getter del prototip: una propietat pròpia el tapa.
    Object.defineProperty(existing, 'subtle', {
      value: { ...existing.subtle, digest },
      configurable: true,
    });
  }
}

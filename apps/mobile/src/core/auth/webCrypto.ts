import * as Crypto from 'expo-crypto';

type WebCrypto = {
  getRandomValues?: typeof Crypto.getRandomValues;
  subtle?: { digest?: (algorithm: string, data: BufferSource) => Promise<ArrayBuffer> };
};

/**
 * Supabase fa el PKCE amb `crypto.getRandomValues` i `crypto.subtle.digest`, que React Native no
 * porta. Sense ells, el verificador surt de `Math.random` i el mètode passa a `plain` (TG-249).
 * Les dues funcions vénen d'`expo-crypto`, que és a Expo Go.
 */
export function installWebCrypto(target: { crypto?: unknown } = globalThis) {
  const crypto = (target.crypto ?? {}) as WebCrypto;
  crypto.getRandomValues ??= Crypto.getRandomValues;
  if (typeof crypto.subtle?.digest !== 'function') {
    crypto.subtle = {
      ...crypto.subtle,
      digest: (algorithm, data) => Crypto.digest(algorithm as Crypto.CryptoDigestAlgorithm, data),
    };
  }
  target.crypto = crypto;
}

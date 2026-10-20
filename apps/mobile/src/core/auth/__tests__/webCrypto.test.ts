import * as Crypto from 'expo-crypto';

import { installWebCrypto } from '../webCrypto';

jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((array: Uint8Array) => array.fill(7)),
  digest: jest.fn(async () => new ArrayBuffer(32)),
}));

it('dona a Supabase el WebCrypto que necessita el PKCE amb S256', async () => {
  const target: { crypto?: unknown } = {};
  installWebCrypto(target);
  const crypto = target.crypto as {
    getRandomValues: (a: Uint8Array) => Uint8Array;
    subtle: { digest: (alg: string, data: BufferSource) => Promise<ArrayBuffer> };
  };
  expect(crypto.getRandomValues(new Uint8Array(2))).toEqual(new Uint8Array([7, 7]));
  const data = new Uint8Array([1]);
  await crypto.subtle.digest('SHA-256', data);
  expect(Crypto.digest).toHaveBeenCalledWith('SHA-256', data);
});

it('no trepitja un WebCrypto que ja hi és', () => {
  const digest = jest.fn();
  const getRandomValues = jest.fn();
  const target = { crypto: { getRandomValues, subtle: { digest } } };
  installWebCrypto(target);
  expect(target.crypto.getRandomValues).toBe(getRandomValues);
  expect(target.crypto.subtle.digest).toBe(digest);
});

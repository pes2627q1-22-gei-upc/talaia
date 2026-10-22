import assert from 'node:assert/strict';
import { test } from 'node:test';

import { senseRedirectsAmbIp } from './configura-correu.mjs';

test('treu només els redirects amb una IP com a host i conserva la resta tal qual', () => {
  const llista = [
    'talaia://**',
    'exp://**',
    'exp://10.24.22.54:8081/--/auth/callback',
    'exp://*.*.*.*:8081/--/auth/callback',
    'exp://192-168-1-50.nip.io:8081/--/auth/callback',
    'https://talaia.duckdns.org:8080/auth/callback',
  ].join(',');
  assert.equal(
    senseRedirectsAmbIp(llista),
    'talaia://**,exp://**,exp://192-168-1-50.nip.io:8081/--/auth/callback,https://talaia.duckdns.org:8080/auth/callback',
  );
});

test('neteja espais i entrades buides, i amb una llista buida torna buit', () => {
  assert.equal(senseRedirectsAmbIp(' talaia://** , ,exp://** '), 'talaia://**,exp://**');
  assert.equal(senseRedirectsAmbIp(''), '');
});

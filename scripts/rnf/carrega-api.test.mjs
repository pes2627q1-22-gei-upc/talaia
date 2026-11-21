import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { URLSearchParams } from 'node:url';

import {
  buildRequests,
  composeReport,
  percentile,
  publicLabel,
  summarize,
} from './carrega-api.mjs';

const sample = (ms, status = 200, bytes = 1000) => ({ ms, status, bytes });

describe('percentile', () => {
  it('fa servir el rang més proper', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(sorted, 50), 50);
    assert.equal(percentile(sorted, 95), 95);
    assert.equal(percentile(sorted, 99), 99);
    assert.equal(percentile([7], 95), 7);
    assert.equal(percentile([], 95), null);
  });
});

describe('summarize', () => {
  it('calcula els percentils només amb les 2xx i compta els 429 a part', () => {
    const samples = [
      ...Array.from({ length: 19 }, (_, i) => sample(100 + i)),
      sample(450),
      sample(5, 429),
      sample(6, 429),
    ];
    const s = summarize(samples);
    assert.equal(s.total, 22);
    assert.equal(s.ok, 20);
    assert.equal(s.limited, 2);
    assert.equal(s.other, 0);
    assert.equal(s.errors, 0);
    assert.equal(s.p95, 118);
    assert.equal(s.max, 450);
    assert.equal(s.meets, true);
  });

  it('no compleix amb un p95 de 500 ms o més, amb errors o amb altres codis', () => {
    assert.equal(summarize([sample(500)]).meets, false);
    assert.equal(summarize([sample(100), sample(10_000, 0)]).meets, false);
    assert.equal(summarize([sample(100), sample(30, 503)]).meets, false);
    assert.equal(summarize([sample(5, 429)]).meets, false);
  });
});

describe('buildRequests', () => {
  it('fa les consultes de recomanacions des de diversos orígens amb els valors d’Explora', () => {
    const requests = buildRequests('recomanacions', { date: '2026-11-11' });
    assert.ok(requests.length > 1);
    const query = new URLSearchParams(requests[0].path.split('?')[1]);
    assert.equal(query.get('data'), '2026-11-11');
    assert.equal(query.get('desDe'), '22');
    assert.equal(query.get('finsA'), '6');
    assert.equal(query.get('tempsMaxim'), '150');
  });

  it('omet /esdeveniments sense credencial i hi posa la que hi ha', () => {
    assert.equal(buildRequests('esdeveniments', { date: '2026-11-11', env: {} }), null);
    const [withKey] = buildRequests('esdeveniments', {
      date: '2026-11-11',
      env: { TALAIA_API_KEY: 'k' },
    });
    assert.equal(withKey.path, '/esdeveniments?des_de=2026-11-11&fins_a=2026-12-10');
    assert.deepEqual(withKey.headers, { 'x-api-key': 'k' });
    const [withJwt] = buildRequests('esdeveniments', {
      date: '2026-11-11',
      env: { TALAIA_JWT: 't', TALAIA_API_KEY: 'k' },
    });
    assert.deepEqual(withJwt.headers, { authorization: 'Bearer t' });
  });

  it('rebutja un endpoint desconegut', () => {
    assert.throws(() => buildRequests('alertes', { date: '2026-11-11' }), /desconegut/);
  });
});

describe('composeReport', () => {
  it('no publica l’adreça de la VM i marca el resultat de cada endpoint', () => {
    assert.equal(publicLabel('http://localhost:3000/api/v1'), 'http://localhost:3000/api/v1');
    const report = composeReport({
      when: '11/11/26, 20:00',
      baseUrl: 'https://exemple.duckdns.org:40000/api/v1',
      version: '0.1.0',
      options: { concurrency: 50, interval: 3, duration: 20 },
      results: [
        { endpoint: 'punts', summary: summarize([sample(120), sample(5, 429)]) },
        { endpoint: 'recomanacions', summary: summarize([sample(800)]) },
        { endpoint: 'esdeveniments', skipped: 'Sense credencial' },
      ],
    });
    assert.ok(!report.includes('exemple.duckdns.org'));
    assert.match(report, /<API_PUBLIC_URL> · versió 0\.1\.0/);
    assert.match(report, /\| \/punts \| 2 \| 1 \| 1 \(50 %\) \|.*\| Compleix \|/);
    assert.match(report, /\| \/recomanacions \|.*\| 800 ms \|.*\| No compleix \|/);
    assert.match(report, /\| \/esdeveniments \|.*\| Sense credencial \|/);
  });
});

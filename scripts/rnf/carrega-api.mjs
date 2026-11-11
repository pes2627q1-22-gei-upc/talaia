/**
 * RNF02 (TG-123): temps de resposta de /punts, /recomanacions i /esdeveniments amb peticions
 * concurrents. Node 22 sense dependències (el fetch de Node). Procediment i resultats: docs/rnf.md.
 *
 *   npm run rnf:api -- --url https://<PUBLIC_HOST>:<PUBLIC_PORT>/api/v1
 *   npm run rnf:api -- --url http://localhost:3000/api/v1 --interval 0
 *
 * Envia ràfegues de `--concurrencia` peticions alhora (per defecte 50, com diu l'RNF), una cada
 * `--interval` segons (3) durant `--durada` segons (20) per endpoint, després d'una ràfega
 * d'escalfament que obre les connexions i no compta. Escriu una taula en Markdown amb p50, p95 i
 * p99 de les respostes 2xx i, a part, els 429 (límit de Nginx), els altres codis i els errors.
 *
 * Nginx limita cada IP a 20 peticions/s amb una ràfega de 40 (TG-253): des d'una sola IP, una
 * ràfega de 50 en deixa passar 41 i la resta reben 429. L'interval de 3 s deixa buidar el comptador
 * entre ràfegues. Per mesurar sense 429, `--concurrencia 40`.
 *
 * /esdeveniments necessita credencial: `TALAIA_API_KEY` (clau d'Aprop, X-API-Key) o `TALAIA_JWT`
 * (Authorization: Bearer) a l'entorn. Sense cap de les dues, l'endpoint s'omet.
 */
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL, URLSearchParams, fileURLToPath } from 'node:url';

export const TARGET_P95_MS = 500;
const TIMEOUT_MS = 10_000;
const ENDPOINTS = ['punts', 'recomanacions', 'esdeveniments'];

/** Orígens de «Què vols veure?» que es van alternant: capitals i Vic. */
const ORIGINS = [
  { lat: 41.3874, lon: 2.1686 }, // Barcelona
  { lat: 41.9794, lon: 2.8214 }, // Girona
  { lat: 41.6176, lon: 0.62 }, // Lleida
  { lat: 41.1189, lon: 1.2445 }, // Tarragona
  { lat: 41.9301, lon: 2.2549 }, // Vic
];

export function localDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(instant);
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Les peticions de cada endpoint, amb els paràmetres que fa servir l'app: `/punts` sense `bbox`
 * (el mapa no el fa servir), `/recomanacions` amb els valors per defecte d'Explora (22–6 h, 150
 * min) des de diversos orígens i `/esdeveniments` amb els 30 dies que comencen a `date`.
 * Retorna `null` si l'endpoint no es pot mesurar (falta la credencial).
 */
export function buildRequests(endpoint, { date, env = {} }) {
  if (endpoint === 'punts') return [{ path: '/punts', headers: {} }];
  if (endpoint === 'recomanacions') {
    return ORIGINS.map(({ lat, lon }) => ({
      path: `/recomanacions?${new URLSearchParams({
        objectiu: 'cel_estrellat',
        lat: String(lat),
        lon: String(lon),
        data: date,
        desDe: '22',
        finsA: '6',
        tempsMaxim: '150',
      })}`,
      headers: {},
    }));
  }
  if (endpoint === 'esdeveniments') {
    const headers = env.TALAIA_JWT
      ? { authorization: `Bearer ${env.TALAIA_JWT}` }
      : env.TALAIA_API_KEY
        ? { 'x-api-key': env.TALAIA_API_KEY }
        : null;
    if (!headers) return null;
    return [{ path: `/esdeveniments?des_de=${date}&fins_a=${addDays(date, 29)}`, headers }];
  }
  throw new Error(`Endpoint desconegut: ${endpoint} (${ENDPOINTS.join(', ')})`);
}

/** Percentil pel mètode del rang més proper, sobre una llista ja ordenada. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** Resum d'una tanda: percentils de les 2xx i recompte de la resta (429, altres codis, errors). */
export function summarize(samples, targetMs = TARGET_P95_MS) {
  const ok = samples.filter((s) => s.status >= 200 && s.status < 300);
  const times = ok.map((s) => s.ms).sort((a, b) => a - b);
  const limited = samples.filter((s) => s.status === 429).length;
  const errors = samples.filter((s) => s.status === 0).length;
  const other = samples.length - ok.length - limited - errors;
  const p95 = percentile(times, 95);
  return {
    total: samples.length,
    ok: ok.length,
    limited,
    other,
    errors,
    p50: percentile(times, 50),
    p95,
    p99: percentile(times, 99),
    max: times.at(-1) ?? null,
    bytes: ok.length ? ok.reduce((sum, s) => sum + s.bytes, 0) / ok.length : null,
    meets: p95 !== null && p95 < targetMs && other === 0 && errors === 0,
  };
}

const ms = (value) => (value === null ? '—' : `${Math.round(value).toLocaleString('ca-ES')} ms`);
const kb = (bytes) =>
  bytes === null
    ? '—'
    : `${(bytes / 1000).toLocaleString('ca-ES', { maximumFractionDigits: 1 })} kB`;
const pct = (part, total) =>
  total
    ? ` (${((100 * part) / total).toLocaleString('ca-ES', { maximumFractionDigits: 0 })} %)`
    : '';

/** L'adreça tal com es pot publicar: la de la VM no va al repo (és al gestor de contrasenyes, P20). */
export function publicLabel(baseUrl) {
  const { hostname } = new URL(baseUrl);
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? baseUrl : '<API_PUBLIC_URL>';
}

/** Informe en Markdown. Funció pura: tot li arriba ja mesurat (es prova sense xarxa). */
export function composeReport({ when, baseUrl, version, options, results }) {
  const lines = [
    `### Càrrega de l'API (RNF02) · ${when}`,
    '',
    `- API: ${publicLabel(baseUrl)} · versió ${version}`,
    `- ${options.concurrency} peticions alhora per ràfega, una ràfega cada ${options.interval.toLocaleString('ca-ES')} s durant ${options.duration} s per endpoint (més una d'escalfament que no compta)`,
    `- Percentils sobre les respostes 2xx, temps fins a l'últim byte. Objectiu: p95 < ${TARGET_P95_MS} ms`,
    '',
    '| Endpoint | Peticions | 2xx | 429 | Altres | Errors | p50 | p95 | p99 | Màx. | Mida | Resultat |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const { endpoint, summary, skipped } of results) {
    if (skipped) {
      lines.push(`| /${endpoint} | — | — | — | — | — | — | — | — | — | — | ${skipped} |`);
      continue;
    }
    const s = summary;
    lines.push(
      `| /${endpoint} | ${s.total} | ${s.ok} | ${s.limited}${pct(s.limited, s.total)} | ${s.other} | ${s.errors} | ${ms(s.p50)} | ${ms(s.p95)} | ${ms(s.p99)} | ${ms(s.max)} | ${kb(s.bytes)} | ${s.meets ? 'Compleix' : 'No compleix'} |`,
    );
  }
  return lines.join('\n');
}

async function measure(url, headers) {
  const start = performance.now();
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.arrayBuffer();
    return { ms: performance.now() - start, status: response.status, bytes: body.byteLength };
  } catch (error) {
    return { ms: performance.now() - start, status: 0, bytes: 0, error: error.name };
  }
}

/** Una ràfega: `concurrency` peticions engegades alhora, repartides entre les variants. */
function wave(baseUrl, requests, concurrency) {
  return Promise.all(
    Array.from({ length: concurrency }, (_, i) => {
      const { path, headers } = requests[i % requests.length];
      return measure(`${baseUrl}${path}`, headers);
    }),
  );
}

async function loadEndpoint(baseUrl, requests, { concurrency, duration, interval }) {
  await wave(baseUrl, requests, concurrency); // escalfament: obre les connexions TLS
  await sleep(interval * 1000);
  const samples = [];
  const start = performance.now();
  while (performance.now() - start < duration * 1000) {
    const waveStart = performance.now();
    samples.push(...(await wave(baseUrl, requests, concurrency)));
    const wait = interval * 1000 - (performance.now() - waveStart);
    if (wait > 0) await sleep(wait);
  }
  return samples;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function positive(name, fallback, { allowZero = false } = {}) {
  const value = Number(argument(name, fallback));
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${name} ha de ser un número ${allowZero ? 'no negatiu' : 'positiu'}`);
  }
  return value;
}

async function main() {
  const baseUrl = argument(
    '--url',
    process.env.TALAIA_API_URL ?? 'http://localhost:3000/api/v1',
  ).replace(/\/$/, '');
  const options = {
    concurrency: positive('--concurrencia', 50),
    duration: positive('--durada', 20),
    interval: positive('--interval', 3, { allowZero: true }),
  };
  const date = argument('--data', localDate());
  const endpoints = argument('--endpoints', ENDPOINTS.join(',')).split(',');

  const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!health.ok) throw new Error(`/health respon ${health.status}`);
  const { version } = await health.json();

  const results = [];
  for (const endpoint of endpoints) {
    const requests = buildRequests(endpoint, { date, env: process.env });
    if (!requests) {
      results.push({ endpoint, skipped: 'Sense credencial (TALAIA_API_KEY o TALAIA_JWT)' });
      continue;
    }
    console.error(`/${endpoint}: ${options.duration} s…`);
    const samples = await loadEndpoint(baseUrl, requests, options);
    results.push({ endpoint, summary: summarize(samples) });
    await sleep(options.interval * 1000); // el límit de Nginx es buida abans del següent
  }

  const when = new Intl.DateTimeFormat('ca-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  console.log(composeReport({ when, baseUrl, version, options, results }));
  if (results.some((r) => r.summary && !r.summary.meets)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  });
}

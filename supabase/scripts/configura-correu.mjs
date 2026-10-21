/**
 * Configura el correu de Supabase Auth del projecte del núvol (TG-252, P21): SMTP de Gmail,
 * plantilles amb el codi de 6 xifres, límit de correus per hora i neteja de les adreces de
 * redirecció amb IP. Fa el mateix que els passos del panell, però queda al repo i es pot repetir
 * (quan hi hagi domini i Resend, només canvien les variables SMTP).
 *
 *   npm run supabase:correu              # mostra la configuració actual i què canviaria
 *   npm run supabase:correu -- --aplica  # l'aplica i la torna a llegir per comprovar-ho
 *
 * Variables (al .env de l'arrel o a l'entorn):
 *   SUPABASE_ACCESS_TOKEN  token personal de https://supabase.com/dashboard/account/tokens
 *   SUPABASE_SMTP_PASS     contrasenya d'aplicació «Supabase» de talaia.pes@gmail.com
 *   SUPABASE_PROJECT_REF   opcional; per defecte el de supabase/.temp/project-ref o el de Talaia
 *
 * Sense dependències: només `fetch` de Node 22. Les plantilles i els assumptes surten de
 * supabase/config.toml i supabase/templates, que són els mateixos del Supabase local.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'https://api.supabase.com/v1';
const PROJECT_REF_TALAIA = 'jdftndjsqvqcbzkivdgh';

const SMTP = {
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: 'talaia.pes@gmail.com',
  smtp_admin_email: 'talaia.pes@gmail.com',
  smtp_sender_name: 'Talaia',
};
/** Correus per hora a tot el projecte (el del correu integrat de Supabase és 2). */
const EMAILS_PER_HOUR = 30;
/** El codi que espera la pantalla de l'app (CODE_LENGTH) i el que diu la plantilla (una hora). */
const OTP = { mailer_otp_length: 6, mailer_otp_exp: 3600 };

const aplica = process.argv.includes('--aplica');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n✖ ${error.message}`);
    process.exit(1);
  });
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'Falta SUPABASE_ACCESS_TOKEN (token personal de https://supabase.com/dashboard/account/tokens).',
    );
  }
  const ref = projectRef();
  const actual = await get(`/projects/${ref}/config/auth`, token);
  console.log(`Projecte ${ref}\n`);
  mostra('Ara', actual);

  const canvis = canvisPrevistos(actual);
  console.log('\nCanvis:');
  for (const [clau, valor] of Object.entries(canvis)) {
    if (actual[clau] === valor) continue;
    console.log(`  ${clau}: ${resum(clau, actual[clau])} → ${resum(clau, valor)}`);
  }

  if (!aplica) {
    console.log('\nNomés lectura. Afegeix --aplica per aplicar-ho.');
    return;
  }
  const pass = process.env.SUPABASE_SMTP_PASS;
  if (!pass) {
    throw new Error(
      "Falta SUPABASE_SMTP_PASS (la contrasenya d'aplicació «Supabase» de talaia.pes@gmail.com).",
    );
  }
  await patch(`/projects/${ref}/config/auth`, token, { ...canvis, smtp_pass: pass });
  const nou = await get(`/projects/${ref}/config/auth`, token);
  console.log('');
  mostra('Després', nou);
  const pendents = Object.entries(canvis).filter(([clau, valor]) => nou[clau] !== valor);
  if (pendents.length > 0) {
    throw new Error(`No s'han aplicat: ${pendents.map(([clau]) => clau).join(', ')}`);
  }
  console.log(
    "\n✔ Fet. Prova-ho a l'app: «Continua amb el correu» amb una adreça de fora de l'equip.",
  );
}

/** El que ha de quedar al projecte, a partir del que hi ha ara. */
function canvisPrevistos(actual) {
  const plantilla = readFileSync(resolve(ROOT, 'supabase/templates/codi-acces.html'), 'utf8');
  const config = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');
  return {
    ...SMTP,
    external_email_enabled: true,
    mailer_subjects_magic_link: assumpte(config, 'magic_link'),
    mailer_templates_magic_link_content: plantilla,
    mailer_subjects_confirmation: assumpte(config, 'confirmation'),
    mailer_templates_confirmation_content: plantilla,
    ...OTP,
    rate_limit_email_sent: EMAILS_PER_HOUR,
    uri_allow_list: senseRedirectsAmbIp(actual.uri_allow_list ?? ''),
  };
}

/** `subject` de `[auth.email.template.<nom>]` a config.toml: una sola font per a local i núvol. */
function assumpte(config, nom) {
  const match = new RegExp(`\\[auth\\.email\\.template\\.${nom}\\]\\s*\\nsubject = "([^"]+)"`).exec(
    config,
  );
  if (!match) throw new Error(`No trobo l'assumpte de ${nom} a supabase/config.toml`);
  return match[1];
}

/** Supabase rebutja els redirects amb una IP com a host: les entrades amb IP no serveixen de res. */
export function senseRedirectsAmbIp(llista) {
  return llista
    .split(',')
    .map((url) => url.trim())
    .filter(
      (url) =>
        url &&
        !/^[a-z]+:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\*\.\*\.\*\.\*)([:/]|$)/i.test(url),
    )
    .join(',');
}

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const linked = resolve(ROOT, 'supabase/.temp/project-ref');
  if (existsSync(linked)) return readFileSync(linked, 'utf8').trim();
  return PROJECT_REF_TALAIA;
}

function mostra(titol, config) {
  const claus = [
    'smtp_host',
    'smtp_port',
    'smtp_user',
    'smtp_admin_email',
    'smtp_sender_name',
    'smtp_pass',
    'mailer_subjects_magic_link',
    'mailer_subjects_confirmation',
    'mailer_templates_magic_link_content',
    'mailer_templates_confirmation_content',
    'mailer_otp_length',
    'mailer_otp_exp',
    'rate_limit_email_sent',
    'uri_allow_list',
  ];
  console.log(`${titol}:`);
  for (const clau of claus) console.log(`  ${clau}: ${resum(clau, config[clau])}`);
}

function resum(clau, valor) {
  if (valor === undefined || valor === null || valor === '') return '(buit)';
  if (clau === 'smtp_pass') return '••••';
  if (clau.startsWith('mailer_templates_')) {
    return String(valor).includes('{{ .Token }}')
      ? 'plantilla amb {{ .Token }}'
      : 'plantilla SENSE {{ .Token }}';
  }
  if (clau === 'uri_allow_list') return `\n    ${String(valor).split(',').join('\n    ')}`;
  return JSON.stringify(valor);
}

async function get(path, token) {
  return crida('GET', path, token);
}

async function patch(path, token, body) {
  return crida('PATCH', path, token, body);
}

async function crida(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detall = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${detall.slice(0, 300)}`);
  }
  return res.json();
}

// Secret de Sign in with Apple per al flux pel navegador (Expo Go, ADR-0016): un JWT signat amb la
// clau .p8 del compte d'Apple Developer. Va a Supabase → Authentication → Apple → «Secret Key (for
// OAuth)». Apple no l'accepta de més de 6 mesos: cal regenerar-lo abans que caduqui.
//
//   node supabase/scripts/apple-secret.mjs <clau.p8> <Key ID> <Team ID> <Services ID>
import { Buffer } from 'node:buffer';
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const [fitxer, keyId, teamId, servicesId] = process.argv.slice(2);
if (!servicesId) {
  process.stderr.write(
    'Ús: node supabase/scripts/apple-secret.mjs <clau.p8> <Key ID> <Team ID> <Services ID>\n',
  );
  process.exit(1);
}

const base64url = (dades) => Buffer.from(JSON.stringify(dades)).toString('base64url');
const ara = Math.floor(Date.now() / 1000);
const caduca = ara + 180 * 24 * 60 * 60;
const capçalera = base64url({ alg: 'ES256', kid: keyId });
const cos = base64url({
  iss: teamId,
  iat: ara,
  exp: caduca,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
});
const signatura = sign('sha256', Buffer.from(`${capçalera}.${cos}`), {
  key: createPrivateKey(readFileSync(fitxer)),
  dsaEncoding: 'ieee-p1363',
}).toString('base64url');

process.stdout.write(`${capçalera}.${cos}.${signatura}\n`);
process.stderr.write(`Caduca el ${new Date(caduca * 1000).toISOString().slice(0, 10)}.\n`);

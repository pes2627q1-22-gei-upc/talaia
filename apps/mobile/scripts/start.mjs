// `npm run mobile`: Expo amb un nom de nip.io en lloc de la IP de l'ordinador.
// Supabase rebutja les adreces de tornada amb una IP com a host (`exp://192.168.…`), i sense
// aquest nom el login de Google i l'enllaç del correu no tornen a l'app a Expo Go (TG-249).
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

/** Primera IPv4 privada de la xarxa local (la que fa servir el mòbil a la mateixa wifi). */
function lanAddress() {
  const privada = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  // Fora les xarxes virtuals (Docker, VPN, màquines virtuals), que el mòbil no veu.
  const virtual = /^(docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|wg|utun|lo)/i;
  const adreces = Object.entries(networkInterfaces())
    .filter(([nom]) => !virtual.test(nom))
    .flatMap(([, llista]) => llista ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal && privada.test(a.address))
    .map((a) => a.address);
  return adreces.find((a) => a.startsWith('192.168.')) ?? adreces[0];
}

const env = { ...process.env };
if (!env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  const ip = lanAddress();
  if (ip) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = `${ip.replaceAll('.', '-')}.nip.io`;
    console.log(`Expo s'anuncia com a ${env.REACT_NATIVE_PACKAGER_HOSTNAME} (vegeu el README).`);
  }
}

// Amb `expo-dev-client` instal·lat (push, ADR-0028), `expo start` obriria el development build:
// per defecte continua sent Expo Go, i `npm run mobile -- --dev-client` obre el build.
const args = process.argv.slice(2);
if (!args.includes('--dev-client') && !args.includes('--go')) args.push('--go');

const expo = spawn('npx', ['expo', 'start', ...args], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
expo.on('exit', (code) => process.exit(code ?? 0));

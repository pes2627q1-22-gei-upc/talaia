# Web d'administració

Client estàtic React + Vite (ADR-0030). Fa servir el mateix Supabase Auth que l'app mòbil, però **l'API** decideix qui és administrador a cada petició (`perfils.rol`, ADR-0029). La web només mostra la zona administrativa després de rebre 204 de `GET /api/v1/admin/me`.

## Desenvolupament

1. Fes servir Node 22 i `npm install` a l'arrel.
2. Copia `.env.example` a `.env.local` dins d'aquesta carpeta. Posa-hi l'URL i la clau pública del **mateix projecte** Supabase que a `apps/mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_ANON_KEY`). No hi posis la clau de servei.
3. Arrenca l'API (`npm run api`, amb `DATABASE_URL` i `SUPABASE_URL` del mateix projecte Supabase) i la web (`npm run admin`). Vite reenvia `/api/v1` a `http://127.0.0.1:3000`, evitant CORS local.
4. La web viu a `/admin/` (`base` de Vite), també en local: `http://localhost:5173/admin/`. Per a Google, afegeix aquesta URL a les URL de redirecció permeses de Supabase Auth.
5. El compte ha de tenir un perfil amb `rol = 'admin'` (vegeu `services/api/README.md`). El correu fa servir el codi de sis xifres; Google torna a la mateixa pàgina amb PKCE. L'entrada per correu no crea comptes nous des de la web administrativa.

L'API es consulta per ruta relativa `/api/v1`: en local la reenvia Vite, i a la VM, Nginx, que serveix la web al mateix origen. L'espai administratiu té seccions per gestionar punts i consultar, bloquejar o desbloquejar usuaris. La llista d'usuaris es pot filtrar per nom, correu i estat; un administrador no pot bloquejar el seu propi compte. Per compilar: `npm run build --workspace apps/admin`.

## Desplegament

A la VM, la web se serveix a `https://<PUBLIC_HOST>:<PUBLIC_PORT>/admin/` (TG-176). No cal fer res a mà: `deploy/nginx/Dockerfile` la compila dins de la imatge de Nginx a cada deploy de `stable`, amb `SUPABASE_URL` i `SUPABASE_ANON_KEY` de `/opt/talaia/.env` com a `VITE_*`. Detalls (rutes, cache, CSP, redirect de Google i primer administrador): [docs/desplegament.md](../../docs/desplegament.md) → «Web d'administració».

## Tests

`npm run test --workspace apps/admin` (Vitest, ADR-0034). Els tests fan servir Testing Library sobre jsdom i cobreixen l'autenticació, la navegació i la gestió de punts i usuaris, inclosos els estats de càrrega i error. Supabase Auth i l'API se simulen (`src/__tests__/support/fakeAuth.ts`); no cal `.env.local` ni cap servei. Amb `-- --coverage` es genera `coverage/lcov.info`, que la CI envia a SonarCloud. La revisió visual en un navegador és independent d'aquests tests.

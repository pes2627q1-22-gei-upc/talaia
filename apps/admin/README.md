# Web d'administració

Client estàtic React + Vite (ADR-0030). Fa servir el mateix Supabase Auth que l'app mòbil, però **l'API** decideix qui és administrador a cada petició (`perfils.rol`, ADR-0029). La web només mostra la zona administrativa després de rebre 204 de `GET /api/v1/admin/me`.

## Desenvolupament

1. Fes servir Node 22 i `npm install` a l'arrel.
2. Copia `.env.example` a `.env.local` dins d'aquesta carpeta. Posa-hi l'URL i la clau pública del **mateix projecte** Supabase que a `apps/mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_ANON_KEY`). No hi posis la clau de servei.
3. Arrenca l'API (`npm run api`, amb `DATABASE_URL` i `SUPABASE_URL` del mateix projecte Supabase) i la web (`npm run admin`). Vite reenvia `/api/v1` a `http://127.0.0.1:3000`, evitant CORS local.
4. Per a Google, afegeix `http://localhost:5173/` a les URL de redirecció permeses de Supabase Auth. En producció, registra també l'URL HTTPS de la web. La publicació i el domini definitiu corresponen a TG-176.
5. El compte ha de tenir un perfil amb `rol = 'admin'` (vegeu `services/api/README.md`). El correu fa servir el codi de sis xifres; Google torna a la mateixa pàgina amb PKCE. L'entrada per correu no crea comptes nous des de la web administrativa.

L'API es consulta per ruta relativa `/api/v1`, també quan Nginx serveixi els fitxers compilats al mateix origen. L'administració de punts i usuaris s'afegeix en tasques posteriors. Per compilar: `npm run build --workspace apps/admin`.

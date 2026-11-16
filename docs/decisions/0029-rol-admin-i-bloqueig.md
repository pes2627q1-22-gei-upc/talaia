# ADR-0029: Rol d'administrador i bloqueig de comptes a la taula `perfils`

**Estat:** Acceptada · **Data:** 2026-11-10 · TG-177 (HU41)

## Context

La web d'administració (HU39, HU41) necessita saber qui és administrador. A més, un compte bloquejat ha de rebre un 403 a totes les rutes protegides de l'API. Fins ara l'API no tenia cap concepte de rol: el `role` del JWT de Supabase sempre és `authenticated`. Hi havia dues opcions:

- **A.** Una columna `rol` a `perfils`, que l'API llegeix de la base de dades a cada petició.
- **B.** El rol a les `app_metadata` del JWT de Supabase, que l'API llegiria del token sense anar a la base de dades.

## Decisió

Opció **A**:

- `perfils.rol text not null default 'usuari'`, amb un `check (rol in ('usuari', 'admin'))`. També `perfils.bloquejat boolean not null default false` i `perfils.data_bloqueig timestamptz`, amb un `check` que les manté coherents.
- `requireAuth({ …, accountStatus })` (`services/api/src/middleware/auth.ts`) valida el JWT i, després, llegeix el rol i el bloqueig del perfil (`ProfileStore.getAccountStatus`). Si el compte està bloquejat, respon **403 `account_blocked`**. Es crea un sol cop, a `routes/index.ts` (`requireUser`), i el fan servir totes les rutes d'usuari.
- `requireAdmin`, posat després de `requireUser`, només deixa passar `rol = 'admin'`. Si no, respon **403 `forbidden`**. Un usuari sense perfil no està bloquejat ni és admin.
- Un administrador pot bloquejar qualsevol compte, també el d'un altre administrador, però no el seu (400 `cannot_block_self`): així sempre en queda algun que pot desfer un bloqueig des de la web. Si un administrador abusa del rol, se li treu amb SQL.
- Per fer administrador algú, cal SQL (un `UPDATE` al SQL Editor de Supabase o una migració); no hi ha cap endpoint per fer-ho:

  ```sql
  update public.perfils set rol = 'admin' where email = '<correu>';
  ```

### Per què així

- Per mirar el bloqueig cal llegir el perfil a cada petició igualment, així que el rol no afegeix cap consulta.
- Un canvi de rol o de bloqueig val a la petició següent. Amb el JWT, no valdria fins que l'app renovés el token (fins a 1 h).
- Per escriure a `app_metadata` cal la clau de servei de Supabase, que l'API no té (ADR-0023).

## Conseqüències

- Cada petició autenticada fa una consulta més, per clau única (`auth_user_id`).
- Les rutes noves d'usuari (alertes, plans, favorits) han de fer servir el `requireUser` de `routes/index.ts`, no un `requireAuth` propi, perquè si no un compte bloquejat hi podria entrar. Les d'administració (TG-174, TG-175, TG-178) han de posar `requireUser, requireAdmin`; el router de `/admin` ja ho fa.
- `/esdeveniments` (Aprop) fa servir `requireAuth` sense `accountStatus`, i el bloqueig no s'hi aplica, com a la resta de rutes públiques.
- L'app reconeix el bloqueig pel codi `account_blocked` (TG-179).

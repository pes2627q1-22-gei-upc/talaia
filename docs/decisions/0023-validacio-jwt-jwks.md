# ADR-0023: Validació del JWT a l'API amb el JWKS de Supabase i `jose`

**Estat:** Acceptada · **Data:** 2026-10-19 · TG-84

## Context

L'app s'autentica amb Supabase Auth (TG-81, TG-83) i envia el JWT d'accés a l'API a la capçalera `Authorization: Bearer`. L'API ha de saber qui és l'usuari per crear-ne el perfil al primer accés (`POST /api/v1/perfil`) i, més endavant, per a les rutes de favorits, alertes i punts propis. Les opcions eren verificar la signatura amb el **secret compartit** del projecte (HS256) o amb les **claus públiques** del JWKS de Supabase (P6).

## Decisió

- `requireAuth` (`services/api/src/middleware/auth.ts`) verifica el token amb `jose` i el JWKS de `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, creat **una sola vegada** amb `createRemoteJWKSet` (que guarda les claus en memòria cau).
- `jwtVerify` exigeix `iss = ${SUPABASE_URL}/auth/v1`, `aud = authenticated`, els algorismes `ES256` o `RS256` i les claims `sub` i `exp`.
- **401** només quan el problema és el token (caducat, claims incorrectes, signatura, format, clau desconeguda, algorisme no permès). **503** per a qualsevol altre error (JWKS caigut, 5xx, temps esgotat, xarxa): així l'app no fa fora l'usuari quan el problema és de Supabase.
- El missatge del 401 és fix; no exposa el detall de `jose`.
- Als tests, `requireAuth` accepta un `jwks` opcional i es fa servir `createLocalJWKSet`: cap test toca la xarxa.

### Per què així

- **Sense secrets a l'API:** les claus són públiques, i `SUPABASE_URL` és l'única variable que cal. El secret compartit hauria de viure a la VM i als secrets de GitHub, i si es filtrava permetria signar tokens.
- **Rotació de claus:** Supabase les rota al JWKS i `jose` les torna a baixar quan troba un `kid` desconegut, sense desplegar res.
- **`jose`** no té dependències, és el que fa servir el mateix Supabase i ja tracta la memòria cau i el refredament del JWKS.

## Conseqüències

- La primera petició autenticada després d'arrencar fa una crida HTTP al JWKS. Després, `jose` el torna a baixar quan la memòria cau té més de 10 minuts (`cacheMaxAge`) o quan arriba un `kid` desconegut: si Supabase no respon just llavors, l'API respon 503 encara que tingui les claus guardades.
- Si `SUPABASE_URL` no apunta al projecte bo, totes les peticions autenticades donen 503 o 401. A la VM arriba per `deploy/compose.yaml`.

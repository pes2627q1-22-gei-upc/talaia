# ADR-0030: Web d'administració amb Vite, React i TypeScript

**Estat:** Acceptada · **Data:** 2026-11-11 · Resol la decisió pendent P11 · TG-173 (HU39)

## Context

La web d'administració ha de ser una aplicació separada de la mòbil per gestionar els punts d'observació (HU39) i els comptes d'usuari (HU41). Només hi poden accedir els administradors. La lògica de negoci i les comprovacions de permisos ja són responsabilitat de l'API Express; la web consumeix les seves rutes. La infraestructura prevista és Nginx a la VM de la FIB, que pot servir fitxers estàtics amb HTTPS.

Cal triar entre **Vite + React** i **Next.js** per construir aquesta web. Les pantalles són eines internes després d'iniciar sessió: no necessiten indexació pels cercadors, renderització al servidor ni rutes de servidor pròpies.

## Decisió

- Crear `apps/admin` com a aplicació independent de **React + TypeScript**, construïda amb **Vite** i integrada als npm workspaces del monorepo (ADR-0008 i ADR-0010).
- Compilar-la a fitxers estàtics. Nginx els servirà amb HTTPS a la VM; la configuració concreta de publicació correspon a la TG-176 (ADR-0006 i ADR-0019).
- Reutilitzar Supabase Auth per iniciar sessió i enviar el JWT a l'API. La web només mostrarà l'àrea administrativa quan la sessió sigui vàlida i l'API confirmi l'accés. L'autorització efectiva de cada operació continuarà a l'API: `requireUser` comprova el bloqueig i `requireAdmin` consulta el rol de `perfils` (ADR-0023 i ADR-0029). La web no llegirà directament la taula de perfils ni contindrà secrets d'administració.
- Compartir els tipus de domini mitjançant `@talaia/shared`, sense duplicar els contractes de l'API.

## Alternativa descartada

**Next.js** facilitaria la renderització al servidor i les rutes de servidor, però aquestes capacitats no són necessàries per a una eina interna autenticada. Afegiria un procés web a desplegar i mantenir a la VM, a més de solapar les seves rutes de servidor amb l'API Express existent. Les seves facilitats d'enrutament i de càrrega de dades no compensen aquest cost per a les pantalles previstes.

## Conseqüències

- El scaffold de la TG-173 inclourà l'arrencada de l'app, l'accés amb sessió i els estats de càrrega, falta de sessió, accés denegat i error. La llista i el formulari de punts són de la TG-175; els endpoints corresponents són de la TG-174.
- La web serà un client estàtic: les peticions de dades i les operacions administratives passaran per l'API. Ocultar una pantalla al navegador no substitueix la comprovació de rol al servidor.
- No caldrà executar un servidor Next.js a producció. La TG-176 haurà de publicar els fitxers compilats a Nginx i resoldre les rutes de l'app en una recàrrega directa.
- Les variables incloses al build del navegador només podran contenir valors públics, com l'URL de Supabase i la seva clau pública; les claus de servei romandran fora de `apps/admin`.

# Decisions pendents

Decisions que encara no estan preses. Si una tasca en depèn, **no les improvisis**: proposa una opció amb el pros i contres i pregunta. Quan es prengui, s'escriu l'ADR corresponent i s'elimina d'aquí.

Llegenda: **Recomanació** = la proposta inicial del sprint master; no és definitiva fins que hi hagi ADR.

## Tècniques (Sprint 1, scaffolds)

P1, P2, P3, P7 i P8 ja estan decidides: [ADR-0010](0010-eines-app.md). P4: [ADR-0011](0011-validacio-openapi-zod.md). P5: [ADR-0013](0013-acces-bd-kysely.md). P6: [ADR-0023](0023-validacio-jwt-jwks.md). P9: [ADR-0024](0024-planificacio-worker-node-cron.md). P10: [ADR-0020](0020-foscor-sqm-geotiff.md). P14: [ADR-0026](0026-contracte-esdeveniments-aprop.md). P22: [ADR-0014](0014-identificador-app-expo-go.md).

| # | Decisió | Opcions | Recomanació | Quan / qui |
|---|---|---|---|---|
| P11 | Web d'administració | Vite + React · Next.js | **Vite + React** (estàtica, servida per Nginx) | Sprint 2 |

## Producte i índex

P12: [ADR-0018](0018-formula-index-v1.md). P13: [ADR-0017](0017-cataleg-inicial-punts.md). P15 (Sign in with Apple): [ADR-0016](0016-sign-in-with-apple-ios.md).

## Infraestructura i organització

P16 i P17: [ADR-0019](0019-allotjament-i-desplegament.md).

| # | Decisió | Notes |
|---|---|---|
| P18 | Accés al repositori | El repositori és a l'organització de l'assignatura, **`pes2627q1-22-gei-upc/talaia`**, i és **públic**. Tot l'equip és membre de l'organització i el professor ha fet administrador del repo en Joan (`Jsolee`). Falta afegir la resta de l'equip com a col·laboradors amb rol *Write* (usuaris a `equip.md`). **Mai cap secret al repo.** |
| P19 | Integració Taiga ↔ GitHub | Activar el webhook de Taiga perquè els commits amb `TG-<ref>` quedin enllaçats a les tasques. |
| P20 | Correu de l'equip i propietat dels serveis | Compte `talaia.pes@gmail.com` creat (2026-10-04). Serà el **propietari** de Supabase, Expo/EAS, Google Cloud (OAuth), Resend, SonarCloud i domini; cada membre hi entra amb el seu compte com a membre de l'organització. Credencials en un gestor de contrasenyes compartit pels admins (Joan, Mohamed), **mai al repo ni al xat**. |
| P21 | Servidor de correu per a Supabase Auth | El correu integrat de Supabase només serveix per a proves: 2 correus per hora, només a adreces de l'equip i sense poder editar les plantilles. **Provisional (2026-10-21, TG-249):** SMTP de Gmail amb `talaia.pes@gmail.com` (contrasenya d'aplicació, ~500 correus/dia), que no necessita domini. Definitiu: **Resend**, quan hi hagi el domini de P17 (el de DuckDNS no deixa crear els registres DNS que demana). |

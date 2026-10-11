# Decisions pendents

Decisions que encara no estan preses. Si una tasca en depèn, **no les improvisis**: proposa una opció amb el pros i contres i pregunta. Quan es prengui, s'escriu l'ADR corresponent i s'elimina d'aquí.

Llegenda: **Recomanació** = la proposta inicial del sprint master; no és definitiva fins que hi hagi ADR.

## Tècniques (Sprint 1, scaffolds)

P1, P2, P3, P7 i P8 ja estan decidides: [ADR-0010](0010-eines-app.md). P4: [ADR-0011](0011-validacio-openapi-zod.md). P5: [ADR-0013](0013-acces-bd-kysely.md). P22: [ADR-0014](0014-identificador-app-expo-go.md).

| # | Decisió | Opcions | Recomanació | Quan / qui |
|---|---|---|---|---|
| P6 | Validació del JWT a l'API | Verificar amb JWKS de Supabase (`jose`) · secret compartit | **JWKS amb `jose`** | TG-84, Martina |
| P9 | Planificació del worker | `node-cron` dins el contenidor · cron del sistema | **node-cron** (tot dins de Docker) | TG-99, Martina |
| P10 | Preprocés del GeoTIFF | `geotiff.js` (Node) · GDAL (script a part) | **geotiff.js** en un script de `data/` que genera la foscor per punt | TG-97, Hugo |
| P11 | Web d'administració | Vite + React · Next.js | **Vite + React** (estàtica, servida per Nginx) | Sprint 2 |

## Producte i índex

| # | Decisió | Notes |
|---|---|---|
| P12 | Fórmula de l'índex v1: pesos de núvols / foscor / Lluna, i llindars de color | TG-98 (Hugo). Ha de ser explicable al desglossament (HU04). |
| P13 | Catàleg inicial de ≥ 30 punts d'observació: quins i amb quines metadades | TG-87 (Mohamed). Criteris: accés en cotxe, foscor, horitzó obert. |
| P14 | Valors de `tipus` de fenomen (enum compartit) | TG-106/109 (Victor), compartit amb Aprop. |
| P15 | Sign in with Apple | Requereix compte de desenvolupador d'Apple de pagament. Si no n'hi ha, HU35 només Google + correu. |

## Infraestructura i organització

| # | Decisió | Notes |
|---|---|---|
| P16 | On s'allotja la VM | Opcions: servidor de la FIB/UPC si n'ofereixen, crèdits d'estudiant (Azure, GitHub Student Pack), VPS barat. TG-71 (Mohamed). |
| P17 | Domini i URL pública de l'API | Necessari per a Let's Encrypt i per als equips Aprop/Mobilicat. |
| P18 | Accés al repositori | El repositori és a l'organització de l'assignatura, **`pes2627q1-22-gei-upc/talaia`**, i és **públic**. Tot l'equip és membre de l'organització i el professor ha fet administrador del repo en Joan (`Jsolee`). Falta afegir la resta de l'equip com a col·laboradors amb rol *Write* (usuaris a `equip.md`). **Mai cap secret al repo.** |
| P19 | Integració Taiga ↔ GitHub | Activar el webhook de Taiga perquè els commits amb `TG-<ref>` quedin enllaçats a les tasques. |
| P20 | Correu de l'equip i propietat dels serveis | Compte `talaia.pes@gmail.com` creat (2026-10-04). Serà el **propietari** de Supabase, Expo/EAS, Google Cloud (OAuth), Resend, SonarCloud i domini; cada membre hi entra amb el seu compte com a membre de l'organització. Credencials en un gestor de contrasenyes compartit pels admins (Joan, Mohamed), **mai al repo ni al xat**. |
| P21 | Servidor de correu per a Supabase Auth | El correu integrat de Supabase només serveix per a proves. Proposta: **Resend** com a SMTP, que requereix el domini de P17. |

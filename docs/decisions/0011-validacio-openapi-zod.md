# ADR-0011: Validació i OpenAPI de l'API amb zod i zod-to-openapi

**Estat:** Acceptada · **Data:** 2026-10-07 · Resol la decisió pendent P4

## Context

L'API (TG-68) ha de validar l'entrada de cada ruta i publicar-ne la documentació OpenAPI, que és també el contracte amb els equips Aprop i Mobilicat (TG-109). Calia triar si l'OpenAPI s'escriu a mà o es genera del codi.

## Decisió

**zod** valida l'entrada i l'entorn, i **`@asteasolutions/zod-to-openapi`** genera l'OpenAPI 3.0 a partir dels mateixos esquemes.

- Cada router registra les seves rutes a `registry` (`services/api/src/openapi.ts`) amb `registry.registerPath(...)`, al mateix fitxer on hi ha la ruta.
- Els esquemes que han de sortir a `components/schemas` porten `.meta({ id: 'Nom' })`. No es fa servir `extendZodWithOpenApi`.
- L'spec es serveix a `GET /api/v1/openapi.json` i la UI (Swagger UI) a `/api/v1/docs`.
- Un `ZodError` arriba al handler central i es respon amb `400 { error: { code: "validation_error", message } }`.

## Alternatives descartades

- **YAML escrit a mà:** el contracte és més fàcil de llegir en una PR, però hi hauria tres fonts de veritat (YAML, validació i tipus) que es desfasen sense que res ho detecti, i calen eines a part per validar (`express-openapi-validator`) i per tenir tipus (`openapi-typescript`).

## Conseqüències

- Una ruta nova no està acabada fins que no l'ha registrada a `registry` (Definition of Done: «documentada»).
- Per revisar el contracte amb un altre equip: `/api/v1/docs`, o adjuntar l'`openapi.json`.
- zod va a la 4 i zod-to-openapi a la 9; s'actualitzen juntes. A l'arrel hi ha un zod 3 que porta Expo: l'API fa servir el seu (`services/api/node_modules`).
- Els esquemes es podran moure a `packages/shared` (TG-112) perquè l'app els reutilitzi.

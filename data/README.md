# data

Scripts de descàrrega i preprocés de dades obertes (contaminació lumínica, elevacions, seeds de punts i fenòmens). Els fitxers grans no es versionen.

**Pendent:** TG-97, TG-106.

## Punts d'observació (TG-87, P13)

La font de veritat del catàleg inicial és **`punts_observacio.geojson`** (GeoJSON RFC 7946, WGS84, coordenades `[lon, lat]`). Es pot obrir i editar a [geojson.io](https://geojson.io) o QGIS, i GitHub el mostra com a mapa a les PR.

Cada `Feature` és un `Point` amb aquestes propietats:

| Propietat | Tipus | Notes |
|---|---|---|
| `slug` | text | Únic i estable (`kebab-case`). El seed fa *upsert* per `slug`. |
| `nom`, `municipi`, `descripcio` | text | En català. |
| `altitud` | enter o `null` | Metres. S'omple amb `fill-altitudes.ts`. |
| `horitzo_obert` | `["N","NE",…]` o `null` | Direccions amb l'horitzó obert, **aproximades**. El perfil real el calcula TG-116 amb el model de 5 m de l'ICGC. |
| `accessibilitat` | text | Com s'hi arriba en cotxe. |
| `font_coordenades` | text | Traçabilitat; no va a la base de dades. |

Les coordenades venen del [geocodificador de l'ICGC](https://eines.icgc.cat/geocodificador) (consulta del 12/10/2026). Tots els punts són `origen = 'OFICIAL'` (sense creador) i `estat = 'PUBLICAT'`. La foscor del cel i l'índex **no** són aquí: els calculen TG-97 i el worker.

### Flux

```bash
node data/scripts/fill-altitudes.ts           # omple les altituds que falten (Open-Meteo, Copernicus DEM 90 m)
node data/scripts/build-seed-punts.ts --check # valida el GeoJSON i comprova que el seed versionat està al dia
node data/scripts/build-seed-punts.ts         # genera supabase/seeds/01_punts_observacio.sql
npx supabase db reset                         # aplica migracions + seeds a la base local
```

Node 22 executa els `.ts` directament, sense dependències. Els tipus es comproven amb `npx tsc -p data` (encara no és a la CI). El fitxer SQL generat es versiona (és el que executa el CLI de Supabase), però no s'edita a mà: es canvia el GeoJSON i es torna a generar.

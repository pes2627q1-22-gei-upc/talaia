# Dades astronòmiques normalitzades

Aquesta carpeta conté les dades estàtiques que TG-106 extreu dels calendaris oficials de
l'International Meteor Organization (IMO) i de la NASA. Els documents originals o altres
fitxers grans es descarreguen a `data/raw/` i no es versionen; al repositori només hi entra el
resultat normalitzat, revisable i traçable.

## Abast de TG-106

- Període inicial: d'octubre de 2026 a desembre de 2027.
- Pluges de meteors rellevants per a Catalunya.
- Eclipsis solars i lunars visibles totalment o parcialment des de Catalunya.
- Text en català. El format admet castellà i anglès opcionals sense duplicar els registres.
- Dates en UTC i format ISO 8601.

Les fases lunars, les conjuncions i les superllunes es calculen a TG-107 i no formen part
d'aquesta ingesta de fonts externes. El resultat calculat i el seu seed són
[`calculats-2026-2027.json`](calculats-2026-2027.json) i
`supabase/seeds/03_fenomens_calculats.sql`.

## Fitxers

- [`dataset.schema.json`](dataset.schema.json): contracte JSON Schema del conjunt de dades.
- [`inventari-fonts.md`](inventari-fonts.md): fonts oficials i selecció raonada d'esdeveniments.
- [`calendaris-2026-2027.json`](calendaris-2026-2027.json): dades normalitzades i traçables.

El conjunt separa quatre conceptes:

1. **Fonts**: document oficial del qual surt la informació.
2. **Fenòmens**: concepte recurrent o general, per exemple `perseides`.
3. **Esdeveniments**: ocurrència datada, per exemple `perseides-2027`.
4. **Període**: interval que s'ha revisat, encara que en algun mes no hi hagi esdeveniments.

Els codis són identificadors estables en `kebab-case`. No depenen del nom traduït i permeten
que l'importador actualitzi un registre si s'executa més d'una vegada, en comptes de
duplicar-lo.

## Decisions del format

### Tipus de TG-106

Els únics valors acceptats en aquesta ingesta són:

- `pluja_estels`
- `eclipsi_solar`
- `eclipsi_llunar`

L'eclipsi solar i el lunar són tipus diferents. El catàleg de la base de dades serà extensible
perquè TG-107 hi pugui afegir altres tipus.

### Fenomen i esdeveniment

Un fenomen descriu què és observable, la seva periodicitat i les propietats que no canvien
entre anys, com la velocitat característica d'una pluja. Un esdeveniment conté les condicions
de la seva ocurrència concreta: dates, màxim, ZHR prevista, radiant, rellevància i dificultat.
Referencia el fenomen mitjançant `fenomen_codi` i evita repetir el nom i la descripció.

La ZHR és la taxa horària zenital: una estimació del nombre de meteors per hora en condicions
ideals, amb cel fosc i el radiant al zenit. El recompte real acostuma a ser inferior. El radiant
és el punt del cel d'on semblen provenir els meteors, però no cal mirar-lo directament.

### Precisió temporal

Les fonts no sempre donen la mateixa precisió. Els contactes d'un eclipsi poden estar
publicats al minut o al segon, mentre que l'inici d'activitat d'una pluja pot indicar només el
dia. Els camps `precisio.*` conserven aquesta diferència i eviten presentar una hora afegida
durant la normalització com si fos un càlcul oficial.

`maxim` és nul quan la font no permet identificar-ne un. Si existeix, ha d'estar entre `inici`
i `fi`.

Quan la font només indica un dia, el dataset representa el màxim a les `12:00:00Z` i declara
`precisio.maxim: "dia"`. El migdia és un marcador neutre per conservar la data, no una hora
astronòmica publicada. Els inicis i finals amb precisió de dia es representen respectivament a
les `00:00:00Z` i les `23:59:59Z`.

### Rellevància per a Catalunya

Tots els esdeveniments versionats han de tenir `rellevant_catalunya: true`. Els textos de cada
ocurrència expliquen la visibilitat i donen un consell específic. No s'hi guarden
coordenades d'un punt d'observació: un esdeveniment no ocorre en un únic punt i les ubicacions
recomanades corresponen al motor de recomanacions.

`rellevancia` (`principal` o `secundari`) i `dificultat_observacio` pertanyen a l'ocurrència,
perquè poden canviar d'un any a l'altre. La interfície pot derivar-ne una explicació simple i
reservar ZHR, radiant i altres valors tècnics per a la vista de «més informació».

### Estat i meteorologia

El dataset no conté un estat `previst`, `confirmat` o `cancel·lat`. Una pluja o un eclipsi no
es cancel·la perquè hi hagi núvols; la meteorologia afecta la possibilitat d'observar-lo. Una
correcció de la font es reflecteix actualitzant el mateix codi estable i conservant-ne la
procedència.

### Idiomes

`textos.ca` és obligatori tant al fenomen com a l'esdeveniment. `textos.es` i `textos.en` són opcionals. L'API de TG-108 podrà
seleccionar l'idioma i retornar camps plans (`nom`, `descripcio`) sense exposar l'estructura
interna de traduccions.

## Ingesta local

El fitxer JSON és la font de veritat. `build-seed-astronomia.ts` valida les dades i genera
`supabase/seeds/02_calendari_astronomic.sql`. El seed carrega primer les fonts, després els
fenòmens i finalment els esdeveniments. Fa `upsert` pel codi estable i només actualitza les
files que han canviat; repetir-lo no crea duplicats ni modifica les dates d'actualització.

```bash
node data/scripts/build-seed-astronomia.ts
node data/scripts/build-seed-astronomia.ts --check
npx supabase db reset
npm run db:types
```

L'ordre dels seeds està garantit pels noms `01_punts_observacio.sql` i
`02_calendari_astronomic.sql`. Les quatre taules noves tenen RLS activat i s'accedeix a les
dades des del backend. El catàleg `tipus_fenomen` inclou els tipus de TG-107, però aquesta
ingesta només aporta pluges i eclipsis. Una correcció d'una font es fa canviant el JSON i
regenerant el seed; no s'edita el SQL generat.

## Validacions de la ingesta

El generador valida les regles essencials del contracte abans de construir el seed:

- que cada `fenomen_codi` i `font_codi` existeixi;
- que no hi hagi codis duplicats;
- que `inici < fi` i que `maxim`, si existeix, pertanyi a l'interval;
- que l'esdeveniment intersecti el període declarat;
- que totes les entrades siguin rellevants per a Catalunya;
- que una reexecució produeixi el mateix resultat sense duplicats.

La migració afegeix restriccions de claus, intervals i valors numèrics a les comprovacions
del generador. Els tipus Kysely es regeneren a partir de la base local després d'aplicar-la.

## Fenòmens calculats (TG-107)

`npm run astronomia:calendari --workspace services/worker` calcula el calendari d'octubre de
2026 a desembre de 2027 amb Astronomy Engine 2.1.19 i escriu el JSON i el seed 03. Amb `-- --check`
comprova que tots dos coincideixen amb el càlcul actual. No cal copiar efemèrides a mà ni
consultar una API. Els codis estables i els `upsert` fan el seed idempotent. La migració de TG-107
permet `font_codi` **o** `metode_calcul` (mai tots dos ni cap), i afegeix `detall_calcul` per als
valors útils de revisió. Les fonts IMO/NASA del seed 02 no canvien.

Es publiquen la Lluna nova i la Lluna plena; si una plena compleix el criteri de superlluna,
es publica **com a superlluna en comptes d'una plena duplicada**. La Lluna nova no és visible:
serveix per planificar observacions amb menys llum lunar. Una «Lluna de sang» és un eclipsi
llunar total, no una fase més: s'identificaria a la ingesta d'eclipsis si n'hi hagués un de
visible des de Catalunya. No se'n genera cap de manera artificial.

El criteri editorial de superlluna és: distància geocèntrica de la Lluna en la fase plena
`<= apogeu - 0,9 × (apogeu - perigeu)`, prenent els extrems orbitals més propers. La definició
de «superlluna» no és oficial ni universal; aquest llindar queda versionat al JSON.

Per a les aproximacions del MVP es consideren la Lluna i Mercuri, Venus, Mart, Júpiter i
Saturn. Es mostregen les posicions **topocèntriques** cada hora des d'un lloc de referència al
Montseny (41,77° N, 2,44° E; 1700 m). Es publica el millor instant observable d'un acostament
continu si la separació és `<= 3°`, els dos astres són a `>= 10°` d'altura, tenen magnitud
aparent `<= 2,5` i el Sol és a `<= -6°`. S'agrupen les mostres separades per menys de 48 hores
per evitar repetir el mateix acostament en nits consecutives. La cerca és horària, no una
resolució analítica del mínim; per això la precisió del màxim és `hora`. És una selecció
conservadora per al MVP, **no** un catàleg complet de conjuncions per a astrònoms experts.
Altres llocs de Catalunya, un horitzó local, els núvols i la contaminació lumínica poden
canviar la visibilitat real.

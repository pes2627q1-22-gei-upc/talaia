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
d'aquesta ingesta.

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

## Validacions de la futura ingesta

A més de validar el JSON contra l'esquema, l'importador comprovarà:

- que cada `fenomen_codi` i `font_codi` existeixi;
- que no hi hagi codis duplicats;
- que `inici < fi` i que `maxim`, si existeix, pertanyi a l'interval;
- que l'esdeveniment intersecti el període declarat;
- que totes les entrades siguin rellevants per a Catalunya;
- que una reexecució produeixi el mateix resultat sense duplicats.

La migració SQL i l'importador s'afegiran quan TG-69 estigui integrada a `snapshot`.

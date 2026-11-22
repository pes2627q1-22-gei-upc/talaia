# Serveis entre equips

L'assignatura demana acordar els contractes dels serveis que Talaia ofereix i consumeix. La
tasca **TG-109** (Victor, límit 14/10) cobreix dues integracions independents:

| Integració | Rol de Talaia | Estat del contracte |
|---|---|---|
| Aprop | Proveïdor d'esdeveniments astronòmics | **Acordat** per correu i confirmat en persona; endpoint implementat a TG-108 |
| Mobilicat | Consumidor de rutes sostenibles | **Especificació rebuda per correu; client de Talaia implementat a TG-135.** L'especificació rebuda encara marca `/routes` com a no implementat (`501`). |

## Oferim a Aprop: esdeveniments astronòmics

Història: **HU43** (E12). [ADR-0026](decisions/0026-contracte-esdeveniments-aprop.md) recull les decisions de TG-109 i TG-108 implementa l'endpoint. La
font executable del contracte és l'OpenAPI generat per `services/api`, disponible a
`GET /api/v1/openapi.json` i a la interfície `/api/v1/docs`.

### Petició acordada

```http
GET /api/v1/esdeveniments?des_de=2027-08-01&fins_a=2027-08-31&tipus=eclipsi_solar
X-API-Key: <clau assignada a Aprop>
```

| Paràmetre | Obligatori | Descripció |
|---|---|---|
| `des_de` | Sí | Primer dia de l'interval, inclòs, en format `YYYY-MM-DD`. |
| `fins_a` | Sí | Últim dia de l'interval, inclòs, en format `YYYY-MM-DD`. |
| `tipus` | No | Categoria del calendari; valors enumerats a continuació. |

Les dates són **dies civils de Catalunya (`Europe/Madrid`)**, no dies UTC. Es consulta des de
`des_de` a les 00:00 fins a les 00:00 de l'endemà de `fins_a` (límit final exclòs). Un
esdeveniment hi entra si `inici < final` i `fi > començament`; la resposta s'ordena per
`inici`. El rang ha d'estar en ordre i no pot superar **366 dies civils inclosos**. No cal
paginació per a aquest volum. Les hores dels esdeveniments retornats són instants ISO 8601
en UTC; la conversió a hora local correspon al consumidor.

Aprop s'autentica amb una API key al header `X-API-Key`, guardada al seu backend i mai a
l'app mòbil. L'app de Talaia consulta la mateixa ruta amb `Authorization: Bearer <JWT>` de
Supabase. És una alternativa, no calen les dues credencials alhora.
Amb JWT, el llistat de l'app pot demanar `Accept-Language: ca|es|en` (també variants com
`es-ES`); el català és el valor per defecte i la reserva per camp. Amb l'API key d'Aprop, el
llistat conserva els textos en català independentment de la capçalera.

`tipus` classifica les entrades per famílies estables; no identifica cada fenomen concret. El
nom diferencia, per exemple, les Perseids de les Gemínids o la lluna plena de la lluna nova:

| `tipus` | Exemples de `nom` | Origen |
|---|---|---|
| `fase_llunar` | Lluna nova, lluna plena | TG-107 |
| `pluja_estels` | Perseides, Gemínides, Oriònides | TG-106 |
| `eclipsi_solar` | Eclipsi solar total | TG-106 |
| `eclipsi_llunar` | Eclipsi lunar penumbral, eclipsi total («lluna de sang») | TG-106 |
| `conjuncio` | Conjunció de Venus i Júpiter | TG-107 |
| `superlluna` | Superlluna plena | TG-107 |

Si Aprop omet el filtre `tipus`, rep totes les categories. No s'exposen sortides i postes del
Sol ni crepuscles: són dades diàries per calcular la visibilitat, no entrades del calendari
d'esdeveniments acordat. Afegir una categoria nova requereix acordar i versionar el contracte
amb Aprop; no s'amplia l'enum públic en silenci.

### Resposta acordada

```json
{
  "data": [
    {
      "id": "eclipsi-solar-total-2027-08-02",
      "tipus": "eclipsi_solar",
      "nom": "Eclipsi solar total",
      "inici": "2027-08-02T07:30:00Z",
      "fi": "2027-08-02T12:43:00Z",
      "maxim": "2027-08-02T10:07:00Z",
      "descripcio": "Eclipsi total globalment, visible de manera parcial des de Catalunya.",
      "ubicacio": {
        "nom": "Centre d'Observació de l'Univers",
        "latitud": 42.024603,
        "longitud": 0.73684
      },
      "font": "NASA"
    }
  ]
}
```

Decisions incorporades arran de la resposta d'Aprop:

- Cada esdeveniment conté una ubicació general recomanada (`nom`, `latitud`, `longitud`) perquè
  el puguin representar al mapa. Al MVP s'obté del punt oficial amb slug
  `centre-observacio-univers`; no es copien coordenades als esdeveniments. Aprop ha confirmat
  que una ubicació general els serveix: no prometem que sigui l'únic lloc d'observació ni el
  millor segons els núvols o la geometria de cada fenomen en temps real.
- Els textos es retornen en català. Aprop va plantejar castellà i anglès, amb
  `?idioma=ca|es|en`, com una possibilitat opcional i disposa de traducció pròpia. No formen part
  de la primera versió del contracte; si s'afegeixen, caldrà versionar-ne la documentació.
- Aprop s'autentica amb API key; l'app de Talaia usa JWT de Supabase.
- No es retorna `estat`: apareixia a la proposta inicial, però després es va acordar en persona
  que el període `inici`--`fi` ja permet saber si és futur, actiu o passat. Un fenomen
  astronòmic no es cancel·la; la meteorologia s'ha de tractar separadament.
- `maxim` pot ser `null` quan la font no publica un instant de màxima activitat.
- `font` és `IMO` o `NASA` per als calendaris importats; per a fases, conjuncions i
  superllunes calculades és el valor de `metode_calcul` (p. ex. `Astronomy Engine 2.1.19`).
- Sense credencial o amb una credencial invàlida, la resposta és 401. Un error temporal de
  la base de dades o del JWKS de Supabase és 503. El límit general de Nginx pot retornar 429
  abans que la petició arribi a l'API.

La ubicació forma part del contracte públic, però no del dataset estàtic de TG-106: TG-108
la llegeix del catàleg de punts oficials. Si el punt de referència no existeix o no és publicat,
el servei ha de fallar explícitament en lloc de retornar una ubicació inventada o `null`.

El contracte amb Aprop es pot integrar i revisar independentment del de Mobilicat: aquest darrer
continua pendent de confirmació i no s'ha de presentar com a acordat en tancar aquesta PR.

### Publicació del servei (TG-142)

Aprop ha confirmat que carregarà els esdeveniments des del seu backend en arrencar i, després,
un cop al dia; durant les proves preveu com a màxim una petició per minut. Per això no cal
habilitar CORS per a Aprop: les peticions no surten d'un navegador.

S'aplica el límit general de Nginx a `/api/v1/`: **20 peticions per segon i per IP**, amb una
ràfega de 40 peticions; quan se supera, Nginx respon **429**. És un límit compartit amb la resta
de l'API, no una quota per clau d'equip. La clau d'Aprop es configura com a secret a la VM i
s'ha de lliurar a l'equip per un canal privat; el valor no es publica al repositori.

El 17/11/2026 es va comprovar la URL pública des d'un client separat de la VM: `GET /health`
va respondre 200, `GET /esdeveniments` sense credencial va respondre 401 i la mateixa consulta
amb la clau d'Aprop va respondre 200 amb dades del calendari (interval 01/11–30/11/2026).
No es va forçar el límit de peticions durant aquesta comprovació.

## Consumim de Mobilicat: rutes sostenibles

El 17/11/2026, Mobilicat va enviar l'especificació OpenAPI completa de
`https://api.mobili.cat`. La seva documentació és a <https://api.mobili.cat/docs>; en l'especificació
rebuda l'operació `/routes` encara porta `x-not-implemented: true` i pot respondre 501. El client de
Talaia està implementat, però cal que Mobilicat activi l'endpoint per poder comprovar-ne la
disponibilitat en viu.

### Contracte de Mobilicat

```http
GET https://api.mobili.cat/routes
```

No requereix autenticació. Paràmetres de query:

| Paràmetre | Format i significat |
|---|---|
| `from` | Origen `lat,lon`, graus decimals WGS84; latitud primer, sense notació exponencial. |
| `to` | Destinació `lat,lon`, amb el mateix format. |
| `time` | Opcional; instant ISO 8601 amb zona horària (`Z` o offset). Per defecte, l'instant actual. El signe `+` s'ha d'enviar codificat com `%2B`. |
| `timePreference` | `DEPART_AT`: sortir no abans de `time` i arribar tan aviat com sigui possible. `ARRIVE_BY`: arribar no més tard de `time` i sortir tan tard com sigui possible. |
| `modes` | Llista separada per comes: `WALK`, `BIKE`, `BIKE_SHARE`, `CAR`, `PUBLIC_TRANSPORT`. `BIKE` i `CAR` són alternatives porta a porta; no es combinen amb transport públic. `BIKE_SHARE` depèn de bicicletes i ancoratges disponibles. |
| `limit` | Nombre màxim d'alternatives totals, d'1 a 5; per defecte 3. Compta també les rutes de cotxe i bici pròpia, i pot tornar-ne menys. |

L'exemple de Mobilicat consulta tres propostes:

```http
GET /routes?from=41.3851%2C2.1734&to=41.4036%2C2.1744&time=2026-11-12T08%3A30%3A00%2B01%3A00&timePreference=ARRIVE_BY&modes=BIKE,WALK&limit=3
```

La resposta 200 té `{ "routes": [...] }`, ordenades de millor a pitjor fins a `limit`. Amb
`DEPART_AT`, és primer la que arriba abans; en cas d'empat, es prioritzen menys transbordaments i
menys distància a peu. `routes: []` és una resposta normal: no s'ha trobat cap proposta amb els
modes i l'horari demanats. Cada ruta conté `startTime`, `endTime`, `durationSeconds` (inclou les
esperes), `distanceMeters` (tots els trams), `walkDistanceMeters`, `transfers` i `stretches` en
ordre. Els trams poden incloure modes, horaris, geometria, dades de línia i alertes de transport
públic. Les alertes mantenen l'idioma de l'operador; la fiabilitat i les opcions d'accessibilitat no
estan implementades. La resposta també pot ser 400 per paràmetres invàlids, 501 si l'operació encara
no està implementada i 503 si el planificador no respon.

Mobilicat demana almenys **5 segons entre consultes del mateix dispositiu**. El seu servei no ha
confirmat encara una latència normal; Talaia ha fixat un timeout inicial de **5 segons**. Els tres
reintents amb backoff exponencial eren opcionals i no es fan: es prioritza retornar de seguida un
estat parcial si Mobilicat falla.

### Contracte públic de Talaia i integració mòbil (TG-135 / TG-136)

La fitxa i la consulta de ruta són independents. L'app obté primer la ubicació del dispositiu i
continua carregant `GET /api/v1/punts/{id}`. Per a distància i temps, demana a Talaia:

```http
GET /api/v1/punts/6f1c2b7e-3a9d-4c58-9e0b-2d7f1a4c8b35/rutes?lat=41.3851&lon=2.1734
```

Requereix autenticació Talaia. `id` és el UUID d'un punt publicat; `lat` i `lon` són coordenades
WGS84 de l'origen. Abans d'enviar-les a Mobilicat, l'API les arrodoneix a tres decimals (uns 100 m
de precisió) per no transmetre la ubicació exacta del dispositiu. Talaia resol la destinació del
catàleg i fa una sola consulta a Mobilicat amb l'instant actual en UTC o amb `sortida` (paràmetre
opcional ISO 8601 amb zona horària), `DEPART_AT`, els cinc modes
i `limit=5`. No repeteix automàticament la consulta. La ubicació forma part de la query i la
resposta porta `Cache-Control: private, no-store`.

La resposta `RutesPunt` a `@talaia/shared` conserva fins a cinc alternatives en l'ordre de
Mobilicat. Cada alternativa conté `sortida`, `arribada`, `duradaSegons`, `distanciaMetres`,
`transbordaments` i `trams` amb `sequence`, `mode` i, quan hi són, `transitMode`, `lineShortName`,
`lineLongName` i `agencyName`. No s'hi exposen geometries, coordenades dels trams, alertes ni una
fiabilitat que el proveïdor encara no calcula.

```json
{
  "estat": "disponible",
  "destacada": {
    "sortida": "2026-11-18T10:00:00.000Z",
    "arribada": "2026-11-18T10:27:00.000Z",
    "duradaSegons": 1620,
    "distanciaMetres": 9400,
    "transbordaments": 1,
    "trams": [
      { "sequence": 0, "mode": "WALK" },
      { "sequence": 1, "mode": "PUBLIC_TRANSPORT", "transitMode": "RAIL", "lineShortName": "R1", "agencyName": "Rodalies" }
    ]
  },
  "alternatives": [
    {
      "sortida": "2026-11-18T10:00:00.000Z",
      "arribada": "2026-11-18T10:27:00.000Z",
      "duradaSegons": 1620,
      "distanciaMetres": 9400,
      "transbordaments": 1,
      "trams": [
        { "sequence": 0, "mode": "WALK" },
        { "sequence": 1, "mode": "PUBLIC_TRANSPORT", "transitMode": "RAIL", "lineShortName": "R1", "agencyName": "Rodalies" }
      ]
    }
  ]
}
```

`destacada` repeteix la primera alternativa. Amb `DEPART_AT`, és la que arriba abans, no
necessàriament la de menor durada; la UI pot mostrar-ne la distància i el temps i permetre consultar
les altres alternatives. Si un mode no apareix a la llista, no s'ha d'afirmar que no existeix cap
ruta d'aquell mode.

| `estat` | Comportament de la resposta | Comportament esperat de l'app |
|---|---|---|
| `disponible` | `destacada` i `alternatives` amb fins a cinc rutes | Mostrar els totals de `destacada`; permetre veure les alternatives rebudes. |
| `sense_rutes` | `destacada: null`, `alternatives: []` | Indicar que no s'han trobat propostes per a aquesta consulta; conservar la fitxa. |
| `no_disponible` | `destacada: null`, `alternatives: []`; HTTP 200 | Indicar que distància i temps no estan disponibles; conservar la fitxa. |

JWT absent o invàlid dona 401 `unauthorized`; un compte bloquejat dona 403 `account_blocked`; un
`id` o unes coordenades invàlides donen 400 `validation_error`; un punt que ja no sigui públic
respon 404 `punt_not_found`, una consulta massa aviat dona 429 `too_many_requests` amb
`Retry-After`, i una fallada d'autenticació o de base de dades respon 503 `service_unavailable` o
`database_unavailable`. L'error extern, el timeout, el 501, el 503 o una resposta malformada de
Mobilicat es transformen en `estat: no_disponible`: no han de fer desaparèixer la fitxa del punt.

Mobilicat demana almenys **5 segons entre consultes del mateix dispositiu**. Com que les peticions
surten de l'API de Talaia, l'API aplica l'interval tant per compte com globalment des de la seva
instància; aquesta és la interpretació conservadora si Mobilicat identifica el client pel servidor
que origina les peticions. La consulta rebutjada abans d'arribar al proveïdor respon 429
`too_many_requests` amb `Retry-After`; no es presenta com una fallada de Mobilicat i la fitxa continua
independent. El límit global actual permet fins a 12 consultes per minut compartides entre usuaris.
El comptador és en memòria i pressuposa una sola instància d'API, com al desplegament actual. Si
s'afegeixen rèpliques, caldrà fer-lo compartit. TG-136 també ha d'evitar duplicats mentre una
consulta és en curs i respectar `Retry-After`. El botó «Com arribar» continua obrint el deep link
del mapa instal·lat al mòbil.

# Serveis entre equips

L'assignatura demana acordar els contractes dels serveis que Talaia ofereix i consumeix. La
tasca **TG-109** (Victor, límit 14/10) cobreix dues integracions independents:

| Integració | Rol de Talaia | Estat del contracte |
|---|---|---|
| Aprop | Proveïdor d'esdeveniments astronòmics | **Acordat** per correu i confirmat en persona; TG-108 en farà la implementació |
| Mobilicat | Consumidor de rutes sostenibles | **Proposta enviada; pendent de resposta**. No bloqueja TG-108 |

## Oferim a Aprop: esdeveniments astronòmics

Història: **HU43** (E12). [ADR-0026](decisions/0026-contracte-esdeveniments-aprop.md) recull les decisions de TG-109 i TG-108 implementarà l'endpoint. La
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

`tipus` classifica les entrades per famílies estables; no identifica cada fenomen concret. El
nom diferencia, per exemple, les Perseids de les Gemínids o la lluna plena de la lluna nova:

| `tipus` | Exemples de `nom` | Origen |
|---|---|---|
| `fase_llunar` | Lluna nova, quart creixent, lluna plena, quart minvant | TG-107 |
| `pluja_estels` | Perseids, Gemínids, Oriònids | TG-106 |
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
- L'autenticació és mitjançant API key.
- No es retorna `estat`: apareixia a la proposta inicial, però després es va acordar en persona
  que el període `inici`--`fi` ja permet saber si és futur, actiu o passat. Un fenomen
  astronòmic no es cancel·la; la meteorologia s'ha de tractar separadament.
- `maxim` pot ser `null` quan la font no publica un instant de màxima activitat.
- `font` és `IMO` o `NASA` per als calendaris importats; per a fases, conjuncions i
  superllunes calculades és el valor de `metode_calcul` (p. ex. `Astronomy Engine 2.1.19`).
- Sense credencial o amb una credencial invàlida, la resposta és 401. Un error temporal de
  la base de dades o del JWKS de Supabase és 503; no es promet cap 429 sense un límit definit.

La ubicació forma part del contracte públic, però no del dataset estàtic de TG-106: TG-108
la llegirà del catàleg de punts oficials. Si el punt de referència no existeix o no és publicat,
el servei ha de fallar explícitament en lloc de retornar una ubicació inventada o `null`.

El contracte amb Aprop es pot integrar i revisar independentment del de Mobilicat: aquest darrer
continua pendent de confirmació i no s'ha de presentar com a acordat en tancar aquesta PR.

## Consumim de Mobilicat: rutes sostenibles

Talaia necessita calcular una ruta entre l'origen de l'usuari i les coordenades d'un punt
d'observació, tant per a una sortida immediata com per a una hora futura. Per al MVP mostrarem
la informació de la ruta i permetrem tornar-la a consultar; el seguiment continu i les
notificacions de canvis queden fora d'aquest primer contracte.

### Dades que Talaia ha proposat enviar

- Coordenades d'origen: latitud i longitud.
- Coordenades de destí: latitud i longitud.
- Instant de sortida desitjat en ISO 8601, que pot ser futur.
- Modes sostenibles acceptats, si Mobilicat permet filtrar-los.

### Dades que Talaia ha proposat rebre

```json
{
  "data": [
    {
      "id": "ruta-123",
      "sortida": "2026-10-17T18:05:00Z",
      "arribada": "2026-10-17T19:42:00Z",
      "durada_minuts": 97,
      "distancia_metres": 68400,
      "fiabilitat_percentatge": 86,
      "trams": [
        {
          "ordre": 1,
          "mode": "a_peu",
          "origen": { "nom": "Origen", "latitud": 41.387, "longitud": 2.17 },
          "desti": { "nom": "Barcelona Sants", "latitud": 41.379, "longitud": 2.14 },
          "inici": "2026-10-17T18:05:00Z",
          "fi": "2026-10-17T18:20:00Z",
          "durada_minuts": 15
        },
        {
          "ordre": 2,
          "mode": "tren",
          "linia": "R2 Nord",
          "origen": { "nom": "Barcelona Sants", "latitud": 41.379, "longitud": 2.14 },
          "desti": { "nom": "Sant Celoni", "latitud": 41.69, "longitud": 2.489 },
          "inici": "2026-10-17T18:27:00Z",
          "fi": "2026-10-17T19:18:00Z",
          "durada_minuts": 51,
          "espera_minuts": 7
        }
      ],
      "incidencies": []
    }
  ]
}
```

Per cada alternativa necessitem la durada i distància totals, l'hora de sortida i arribada, el
percentatge de fiabilitat i una seqüència ordenada de trams. Cada tram ha d'identificar el mode,
els llocs d'inici i final amb coordenades, els instants d'inici i final, i la línia o servei quan
sigui transport públic. Les esperes, transbordaments i incidències han de quedar explícits perquè
Talaia no recalculi ni contradigui l'itinerari de Mobilicat.

### Punts pendents de confirmació de Mobilicat

- URL base, path i mètode HTTP definitius.
- Noms exactes dels camps i format final de la petició i la resposta.
- Mecanisme d'autenticació i gestió de credencials.
- Modes de transport i valors enumerats.
- Significat i càlcul del percentatge de fiabilitat.
- Freqüència d'actualització de retards i incidències.
- Errors, límits de peticions, timeout i disponibilitat del servei.
- Possibilitat de recalcular una ruta conservant el mateix identificador.

Fins que Mobilicat confirmi el contracte, aquesta secció és una **proposta**, no una dependència
implementable. Quan responguin, s'actualitzaran els noms i exemples sense inventar-ne cap.

La futura integració quedarà darrere d'una interfície `RouteProvider` a l'API de Talaia. Això
permetrà simular el proveïdor durant el desenvolupament i substituir-lo sense afectar l'app.

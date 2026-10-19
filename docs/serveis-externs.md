# Serveis entre equips

L'assignatura demana acordar els contractes dels serveis que Talaia ofereix i consumeix. La
tasca **TG-109** (Victor, límit 14/10) cobreix dues integracions independents:

| Integració | Rol de Talaia | Estat del contracte |
|---|---|---|
| Aprop | Proveïdor d'esdeveniments astronòmics | **Acordat** per correu i confirmat en persona; TG-108 en farà la implementació |
| Mobilicat | Consumidor de rutes sostenibles | **Proposta enviada; pendent de resposta**. No bloqueja TG-108 |

## Oferim a Aprop: esdeveniments astronòmics

Història: **HU43** (E12). TG-109 defineix el contracte i TG-108 implementarà l'endpoint. La
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

Es retornen els esdeveniments que intersecten l'interval, ordenats per `inici`. No cal
paginació per al volum previst del calendari. L'accés es protegeix amb una API key al header
`X-API-Key`; la clau queda al backend d'Aprop i no en una aplicació client.

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
d'esdeveniments acordat.

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
        "nom": "Montseny",
        "latitud": 41.759,
        "longitud": 2.394
      },
      "font": "NASA"
    }
  ]
}
```

Decisions incorporades arran de la resposta d'Aprop:

- Cada esdeveniment conté una ubicació general recomanada (`nom`, `latitud`, `longitud`) perquè
  el puguin representar al mapa. Aprop ha confirmat que una ubicació general els serveix; no
  prometem que sigui l'únic lloc d'observació ni el millor segons els núvols en temps real.
- Els textos es retornen en català. Aprop va plantejar castellà i anglès, amb
  `?idioma=ca|es|en`, com una possibilitat opcional i disposa de traducció pròpia. No formen part
  de la primera versió del contracte; si s'afegeixen, caldrà versionar-ne la documentació.
- L'autenticació és mitjançant API key.
- No es retorna `estat`: apareixia a la proposta inicial, però després es va acordar en persona
  que el període `inici`--`fi` ja permet saber si és futur, actiu o passat. Un fenomen
  astronòmic no es cancel·la; la meteorologia s'ha de tractar separadament.
- `maxim` pot ser `null` quan la font no publica un instant de màxima activitat.

La ubicació forma part del contracte públic, però no del dataset estàtic de TG-106: TG-108
l'obtindrà del catàleg de punts oficials o d'una regla de recomanació acordada. El contracte no
promet que sigui el millor punt segons la meteorologia en temps real.

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

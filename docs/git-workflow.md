# Flux de Git: Gitflow + Conventional Commits

L'equip treballa amb **[Gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)** i escriu els commits amb **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)**. Els noms de les branques permanents són els que demana l'assignatura (`snapshot`, `stable`, `prod`); aquí sota hi ha a quina branca de Gitflow correspon cadascuna. Decisió: `decisions/0009-gitflow.md`.

## Branques permanents

| Branca | Rol a Gitflow | Què conté | Hi entra |
|---|---|---|---|
| `snapshot` (per defecte) | **`develop`** | Integració del sprint en curs | `feature/*` · tancament de `release/*` i `hotfix/*` |
| `stable` | **`main`** | Historial oficial de versions: una per sprint, amb etiqueta | Només `release/*` i `hotfix/*` |
| `prod` | Branca de desplegament (extensió de Gitflow) | La versió publicada (servidor de producció i botigues) | Només `stable` quan es publica |

Protecció (ruleset de GitHub «Branques permanents (snapshot, stable, prod)»): PR obligatòria amb 1 aprovació (es descarten si hi ha commits nous i cal resoldre les converses), només *merge commit*, sense esborrar ni force-push. **No hi ha cap *bypass***, tampoc per als administradors del repo: cap push directe i cada PR necessita l'aprovació d'una altra persona. Quan existeixi la CI (TG-70), s'hi afegirà «Require status checks to pass».

## Branques de suport

| Tipus | Surt de | Torna a | Nom |
|---|---|---|---|
| **feature** | `snapshot` | `snapshot` | `feature/TG-<ref>-descripcio-curta` |
| **release** | `snapshot` | `stable` **i** `snapshot` | `release/<versió>`, p. ex. `release/0.1.0` (Sprint 1) |
| **hotfix** | `stable` | `stable` **i** `snapshot` (i `prod` si ja hi és) | `hotfix/<versió>`, p. ex. `hotfix/0.1.1` |

- Una **feature** per tasca (o història petita) de Taiga. Mai toca `stable` ni `prod`.
- La **release** es crea en tancar el sprint: a partir d'aquí només s'hi fan correccions, versió i notes. No hi entren features noves.
- El **hotfix** és l'única branca que surt de `stable`.
- Tot es fusiona amb **merge commit** (`--no-ff`), com a Gitflow, per conservar la història de cada branca.

### Versions

[SemVer](https://semver.org/): el sprint *N* es publica com a `0.N.0` (Sprint 1 → `v0.1.0`), els hotfixos pugen el pedaç (`v0.1.1`) i la versió final del curs serà `v1.0.0`. L'etiqueta va sempre sobre `stable`.

## Commits: Conventional Commits 1.0.0

```
<tipus>[(àmbit)][!]: <descripció>

[cos opcional]

[peus opcionals]
Refs: TG-<ref>
```

- **Tipus:** `feat` (funcionalitat nova → versió *minor*), `fix` (correcció → *patch*), i també `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Àmbit** (opcional, recomanat): `mobile`, `admin`, `api`, `worker`, `shared`, `data`, `infra`, `deps`.
- **Descripció:** en català, en imperatiu o present, començant en minúscula, sense punt final, ≤ 72 caràcters amb el prefix.
- **Canvi incompatible:** `!` després del tipus/àmbit i/o un peu `BREAKING CHANGE: …` (→ versió *major*).
- **Peu `Refs: TG-<ref>` obligatori** a cada commit (l'assignatura exigeix lligar-los a Taiga). Diverses tasques: `Refs: TG-88, TG-91`. L'estat de la tasca no es canvia des dels commits, sinó a mà a Taiga: vegeu «Integració Taiga ↔ GitHub».

Exemples:

```
feat(api): afegeix GET /punts amb filtre per bbox

Refs: TG-88
```

```
fix(mobile): centra el mapa a la ubicació a Android

Refs: TG-90
```

```
feat(api)!: canvia el format d'errors a { error: { code, message } }

BREAKING CHANGE: els clients han de llegir error.code en lloc de message.
Refs: TG-68
```

### Integració Taiga ↔ GitHub

El webhook de Taiga només **enllaça** cada commit amb la seva tasca: llegeix els commits que arriben a GitHub (només els *push*: no mira ni el títol ni la descripció de les PR) i, si el missatge porta `TG-<ref>`, hi deixa el comentari «mentioned in commit» amb l'enllaç al commit. Per això serveix el peu `Refs: TG-<ref>`, que commitlint exigeix a cada commit.

L'**estat de la tasca es canvia a mà a Taiga**, no des dels commits:

1. **«En curso»** en començar-la.
2. **«Ready for test»** en obrir la PR.
3. **Tancada** en fusionar-la, amb les **Hores reals** (el merge commit de GitHub només porta el títol de la PR).

No escriguis `TG-<ref> #<estat>` als commits: Taiga encara l'aplicaria.

**Per què sense etiquetes d'estat.** Taiga aplica les etiquetes de tots els commits de cada *push* sense mirar l'estat actual de la tasca ni l'edat del commit, i la integració només té URL i *secret*: no es pot demanar que ignori els commits ja vistos. En fusionar `snapshot` en una branca i fer-hi *push*, els commits antics entren al *payload* i les seves etiquetes desfan els canvis manuals. El 15/11/2026, la TG-138 (tancada a mà a les 17:08) es va reobrir a les 21:24 amb el *push* de `feature/TG-179-avis-compte-bloquejat`, que repetia `97800b1` (`#in-progress`) i `1fb24d6` (`#ready-for-test`); la TG-181 es va reobrir 4 cops per `30212bd`, i la TG-260 (tancada a les 10:19 del 16/11) es va reobrir a les 10:24 amb `5e33d80`.

Configuració, un cop (cal ser administrador del projecte de Taiga i del repositori):

1. Taiga → Admin → Integracions → GitHub: copiar la *payload URL* i la *secret key* (o deixar la que genera).
2. GitHub → Settings → Webhooks → Add webhook: la *payload URL* de Taiga, *content type* `application/json`, la mateixa *secret* i només l'esdeveniment **push** («Just the push event»): amb els d'*issues*, Taiga crearia una issue per cada issue de GitHub, també les del parte de la daily.

### Validació automàtica (husky)

`npm install` activa els hooks de Git (`.husky/`):

- **pre-commit:** lint-staged passa `eslint --fix` i Prettier pels fitxers del commit. Si queda algun error d'ESLint, el commit s'atura.
- **commit-msg:** commitlint (`commitlint.config.mjs`) aplica `@commitlint/config-conventional` amb la capçalera de 72 caràcters com a màxim i la descripció en minúscula, i rebutja el commit si no hi ha la línia `Refs: TG-<ref>`. Els merge commits (`Merge pull request…`, `Merge branch…`) en queden exempts.

Per comprovar un missatge sense fer el commit: `printf 'feat: x\n\nRefs: TG-1' | npx commitlint`.

## Pull requests

- Títol en format Conventional Commits (és el missatge del merge). Descripció amb la plantilla (`.github/pull_request_template.md`): tasca de Taiga, què canvia, com provar-ho, captures si és UI.
- Mínim 1 revisió aprovada d'una altra persona. Qui obre la PR no l'aprova.
- Abans de demanar revisió: actualitzar la branca amb `snapshot` i passar `npm run lint`, `npm run typecheck` i `npm test` en local.
- En fusionar: tancar la tasca a Taiga i anotar les **Hores reals**. GitHub esborra la branca de suport.

## Receptes

```bash
# Feature
git switch snapshot && git pull
git switch -c feature/TG-88-endpoint-punts
# … commits …
git push -u origin HEAD        # i PR cap a snapshot

# Release (final de sprint, la fa el sprint master)
git switch snapshot && git pull
git switch -c release/0.1.0
# només correccions, versió i notes; PR cap a stable
# un cop fusionada: etiqueta v0.1.0 a stable i PR release/0.1.0 → snapshot

# Hotfix
git switch stable && git pull
git switch -c hotfix/0.1.1
# PR cap a stable (etiqueta v0.1.1) i PR cap a snapshot
```

## Calendari de branques per sprint

1. Durant el sprint: features → `snapshot`.
2. Dos dies abans de la retrospectiva: `release/0.N.0` des de `snapshot` (congelació).
3. Retrospectiva: `release/0.N.0` → `stable`, etiqueta `v0.N.0` (és el que es mostra a la review) i tornada a `snapshot`.
4. Publicació (final del curs): `stable` → `prod`.

El servidor es desplega des de `stable` durant el desenvolupament (TG-71) i des de `prod` per a la versió final.

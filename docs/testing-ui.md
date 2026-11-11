# Proves de presentació de la UI (TG-260)

Les pantalles han de mostrar botons, textos i desplegables sencers, sense
superposicions ni elements tapats. Aquesta guia concreta el criteri de les tasques
de frontend del [Sprint 2](sprint-2.md) i de la plantilla de PR.

## Qui ho comprova i quan

- **Pantalles existents:** la TG-260 inventaria les pantalles, revisa els tests
  disponibles i completa les comprovacions que faltin. No cal duplicar proves
  que ja cobreixen el mateix comportament.
- **Pantalles noves:** qui les implementa incorpora els tests rellevants i la
  comprovació visual a la mateixa tasca i PR.
- **Pantalles modificades:** qui fa el canvi actualitza els tests afectats i revisa
  visualment la pantalla i els components compartits afectats pel canvi.

La CI executa els tests automàtics. La revisió visual es fa a Expo Go; no cal
revisar manualment totes les pantalles en cada PR, sinó les afectades pel canvi.

## Tests automàtics

A l'app mòbil utilitzem Jest i React Native Testing Library. Els tests viuen al
directori `__tests__` del mòdul o component, seguint els exemples existents de
`apps/mobile/src/features` i `apps/mobile/src/shared/ui`.

Per cada pantalla nova o modificada, cobreix els comportaments rellevants:

- Els elements principals i els estats aplicables de càrrega, error, dades buides
  i contingut es renderitzen correctament.
- Els botons executen l'acció o navegació esperada i respecten els estats
  desactivats quan pertoqui.
- Els desplegables o selectors s'obren, permeten seleccionar una opció i
  reflecteixen la selecció.
- Els formularis validen les dades i mostren els errors corresponents.

Agrupa les proves per comportament. No cal un test separat per cada text, ni
repetir els tests interns d'un component compartit a totes les pantalles. Els
tests del ViewModel i dels serveis continuen sent necessaris segons les
convencions del projecte; no substitueixen les proves de la View.

Per executar els tests de l'app:

```bash
npm run test --workspace apps/mobile -- --ci --runInBand
```

Un test que troba un text o un botó no demostra que es vegi sencer al dispositiu.
Els snapshots i el percentatge de cobertura tampoc substitueixen la revisió visual.

## Comprovació visual a Expo Go

Revisa les pantalles afectades i els seus estats rellevants en un dispositiu o
emulador amb Expo Go, respectant l'entorn admès del projecte:

- Textos llegibles i sencers, sense retalls involuntaris ni superposicions.
- Botons visibles, accessibles al tacte i amb l'etiqueta sencera.
- Desplegables, selectors, fulls i diàlegs oberts: opcions llegibles i accessibles,
  incloses les que requereixin desplaçament.
- Formularis amb el teclat obert: camps, errors i accions accessibles.
- Contingut amb textos llargs, pantalla petita i mida de text ampliada.
- Idiomes ca/es/en quan la llargada dels textos pugui afectar el disseny.
- Àrees segures, navegació i estats de càrrega, error o dades buides quan pertoqui.

Si el canvi afecta comportaments diferents a Android i iOS, comprova les dues
plataformes quan estiguin disponibles. Registra sempre què has provat i què queda
pendent: provar una configuració no valida automàticament les altres.

## Evidències a la PR i seguiment de la TG-260

A «Com provar-ho» de la PR, indica els tests executats i el resultat. A «Captures
i comprovacions d'UI», anota les pantalles i estats revisats, el dispositiu o
emulador, la plataforma, els idiomes i la mida de text utilitzats. Adjunta captures
o vídeo dels casos rellevants i indica qualsevol comprovació pendent.

Per a l'inventari de pantalles existents de la TG-260, utilitza aquest format al
registre de revisió; aquesta guia no dona cap pantalla per comprovada:

| Pantalla | Estats i interaccions | Tests existents o afegits | Entorn visual | Resultat i evidència | Pendent |
| --- | --- | --- | --- | --- | --- |
| Nom o ruta | Contingut, error, selector obert… | Fitxers i resultat | Dispositiu, SO, idioma, mida de text | Captura, vídeo o problema reproduïble | Prova o plataforma pendent |

Només marca la comprovació d'UI de la PR com a feta quan hagis executat les proves
aplicables i deixat constància del resultat. Les comprovacions pendents s'han de
fer explícites per a la revisió.

Si detectes un defecte, segueix [gestio-bugs.md](gestio-bugs.md): els errors de la
implementació en curs es resolen a la mateixa tasca; els possibles bugs
preexistents s'han de reproduir en un entorn admès i comunicar a la persona
responsable. No creïs issues ni ampliïs l'abast de la tasca sense confirmar-ho.

## Tasca de Taiga

TG-<ref> · <títol de la tasca>

## Què canvia

-

## Com provar-ho

1.

## Captures i comprovacions d'UI (si toca)

<!-- Segueix docs/testing-ui.md: pantalles i estats revisats, dispositiu/plataforma,
idioma i mida de text, resultat, captures o vídeo i comprovacions pendents. -->

## Checklist

- [ ] Branca Gitflow correcta (`feature/TG-<ref>-…` cap a `snapshot`, o `release/*` / `hotfix/*`) i al dia amb la branca de destí
- [ ] Títol i commits en Conventional Commits 1.0.0, amb el peu `Refs: TG-<ref>`
- [ ] Lint, typecheck i tests passen en local
- [ ] Tests nous o actualitzats
- [ ] OpenAPI / docs actualitzats si toca
- [ ] Textos via i18n i colors via tokens del design system
- [ ] Si toca UI: provat al dispositiu, amb el moviment i els estats de càrrega i error revisats (captura o vídeo a dalt; `docs/design-system.md` → «Moviment i fluïdesa»)
- [ ] Si toca UI: tests automàtics rellevants i comprovació visual de les pantalles noves o modificades, amb resultats i evidències segons [la guia de proves d'UI](https://github.com/pes2627q1-22-gei-upc/talaia/blob/snapshot/docs/testing-ui.md) (botons, textos i desplegables sencers, sense superposicions ni elements tapats)
- [ ] Tasca a «Ready for test» a Taiga (amb la integració, `TG-<ref> #ready-for-test` al darrer commit: `docs/git-workflow.md`)
- [ ] Hores reals anotades a Taiga en tancar

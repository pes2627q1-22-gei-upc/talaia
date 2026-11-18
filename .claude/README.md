# `.claude/`: configuració compartida de Claude Code

Claude Code la llegeix sola en obrir el repositori. El context general del projecte és al `CLAUDE.md` de l'arrel. Aquí hi ha el que l'amplia:

| Carpeta o fitxer | Què hi ha | Quan es carrega |
|---|---|---|
| `settings.json` | Permisos compartits: què es pot fer sense preguntar, què demana confirmació i què està prohibit | En començar la sessió |
| `rules/*.md` | Convencions i trampes de cada àrea, amb `paths:` | Quan Claude toca un fitxer d'aquella àrea |
| `skills/<nom>/SKILL.md` | Fluxos de l'equip que s'invoquen amb `/nom` | Quan s'invoquen o quan la tasca ho demana |
| `agents/*.md` | Subagents amb una sola feina i les eines limitades | Quan Claude hi delega una tasca |

Fora d'aquesta carpeta:
- `.worktreeinclude`, a l'arrel: els `.env` que es copien a cada worktree nou;
- `.claude/settings.local.json` i `CLAUDE.local.md`: configuració personal, que el `.gitignore` deixa fora del repo.

## Com afegir-ne

- **Una regla nova** només quan una trampa ja ens ha passat o es repetirà. Una línia per trampa, amb la PR o l'ADR on es va veure.
- **Una skill nova** per a un flux que fem sovint i sempre igual. En català i curta (menys de 500 línies): ha d'enllaçar `docs/` en lloc de copiar-ho. Si té efectes fora del repo (PR, revisions, `db push`), porta `disable-model-invocation: true`.
- **Un agent nou** quan una feina és independent i convé que no ompli el context principal. Una sola responsabilitat i només les eines que necessita. Els que revisen no poden editar ni publicar.
- **El que és personal** no va aquí: va al teu `~/.claude/`.

Referència: <https://code.claude.com/docs/en/claude-directory>.

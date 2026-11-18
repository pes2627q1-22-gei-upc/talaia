# ADR-0035: Avís per correu quan falla el deploy de la VM

**Estat:** Proposada · **Data:** 2026-11-17 · TG-180 · Complementa l'[ADR-0021](0021-deploy-per-pull-des-de-la-vm.md)

## Context

Des de l'ADR-0021, el deploy el fa un cron de la VM cada 5 minuts, i el resultat no surt a GitHub Actions. Un deploy fallat només queda a `~/talaia-deploy.log` de la VM. El cron el torna a provar a cada passada, i ningú se n'assabenta fins que algú hi entra o l'app deixa de funcionar. L'app, Aprop i Mobilicat fan servir aquesta VM.

L'avís ha de complir quatre condicions:

- **No ha de fer soroll.** Ha d'arribar un sol avís per fallada, no un cada 5 minuts.
- **Ha de dir quan s'ha recuperat.**
- **No ha de portar cap secret.**
- **No ha de trencar el principi de l'ADR-0021**, que la VM només baixa `stable`, ni afegir permisos d'escriptura sobre el repo.

Opcions:

- **A. Correu des del Gmail de l'equip.** `curl` parla SMTP amb STARTTLS (`smtp.gmail.com:587`) amb una contrasenya d'aplicació del compte de l'equip (P20), el mateix compte que ja envia els correus de Supabase Auth (P21).
- **B. ntfy.sh.** `curl -d "…" ntfy.sh/<tema-secret>`. És una notificació al mòbil al moment i no demana compte.
- **C. Issue a GitHub.** `curl` a l'API de GitHub amb un token, i l'avís queda al repo amb historial.

## Decisió

Opció **A** (proposta, pendent que l'equip la confirmi).

- `desplega.sh` posa un `trap` d'`EXIT` després del `flock`, que només actua si el codi de sortida no és 0. Les sortides normals (lock ocupat, cap canvi) surten amb 0 i no avisen. El trap escriu `ERROR (<pas>)` al log i crida `deploy/scripts/avisa.sh fallada`.
- **Un sol avís per fallada.** `.git/talaia-avisat` guarda la clau de l'última fallada avisada. La clau és el commit o, si falla el `git fetch` (encara no se sap el commit), el valor fix `git-fetch`. Si la clau coincideix, no s'envia res.
- **Recuperació.** Quan un deploy acaba bé, o quan el fetch torna a anar i no hi ha res de nou, `avisa.sh recuperat` envia el correu de recuperació si hi ha `.git/talaia-avisat`, i l'esborra.
- **Deploy pendent.** Quan un deploy falla, `.git/talaia-pendent` guarda el commit, surti o no el correu, i s'esborra només quan passa el healthcheck. Mentre hi sigui, el cron torna a desplegar encara que `stable` no hagi canviat (un `FORCE=1` fallat, o `stable` que torna a l'últim commit bo). Així, saber si cal redesplegar no depèn de si s'ha avisat (#155).
- L'estat de l'avís només es desa si el correu ha sortit. Si no surt, queda `AVÍS` al log i es torna a provar a la passada següent. L'avís surt sempre amb 0 i no canvia el codi de sortida del deploy.
- **Què porta el correu:** el pas, el commit, l'hora, la màquina i les últimes 30 línies del log. Mai el fitxer d'entorn.
- **Variables:** `ALERT_SMTP_URL`, `ALERT_FROM`, `ALERT_TO` (separades per comes) i `ALERT_SMTP_PASSWORD`, a `/opt/talaia/.env`. Si en falta alguna, no s'envia res, com amb `METEOCAT_API_KEY` al worker. La contrasenya d'aplicació és pròpia, diferent de la de Supabase, perquè es pugui revocar per separat. Va a curl per un fitxer de configuració 0600, no per la línia d'ordres.
- `deploy-check.yml` passa `shellcheck` als scripts i prova `avisa.sh` contra un Mailpit amb STARTTLS i autenticació (`deploy/tests/prova-avis.sh`).

## Conseqüències

- Tothom qui sigui a `ALERT_TO` sap d'una fallada en menys de 5 minuts, sense entrar a la VM i sense cap servei ni compte nou: `curl` ja és a la VM.
- Hi ha un secret més a `/opt/talaia/.env` i al gestor de contrasenyes.
- El correu pot acabar a la carpeta de correu brossa. Cal marcar-lo com a correu bo el primer cop.
- Gmail limita els enviaments a uns 500 correus al dia, compartits amb Supabase Auth (P21). Com que s'envia un correu per fallada, l'avís no s'hi acosta.
- Quan Supabase passi a Resend (P21, definitiu), l'avís pot continuar pel Gmail o passar-hi canviant `ALERT_SMTP_URL`, sense tocar el codi.
- **No cobreix** un servei que cau **entre** deploys, perquè no hi ha cap healthcheck periòdic. Si l'equip el vol, és una tasca nova: una línia de `crontab` que cridi `avisa.sh` amb el resultat d'un `curl` al `/health`.

## Alternatives descartades

- **B (ntfy.sh).** Afegeix un servei extern nou, i qualsevol que sàpiga el tema pot llegir els avisos. No porten secrets, però sí els logs de la VM. També caldria que cadascú s'instal·lés l'app.
- **C (issue a GitHub).** Un token amb permís d'escriptura sobre el repo a la VM trenca el principi de l'ADR-0021 que la VM només baixa `stable`. Si la VM quedés compromesa, aquest token donaria accés al repo.

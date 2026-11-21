# Comprovacions manuals de la UI — TG-175

**Data de la comprovació:** 21/11/2026

**Entorn:** web d'administració local a Safari; API i app mòbil locals; projecte
Supabase remot compartit amb l'app.

La persona responsable de la tasca ha fet la revisió visual i ha executat el
flux complet amb un punt real de Sant Cugat. No s'hi han detectat elements
superposats, tapats o retallats.

| Pantalla / flux | Comprovació | Resultat |
| --- | --- | --- |
| Llista de punts | Cerca parcial i cerca amb accents; comprovació visual dels textos, botons i filtres | Correcte; la llista es filtra com s'espera i els controls es mostren sencers |
| Formulari | Creació i edició de les dades del punt; revisió visual dels camps, selectors i accions | Correcte; les dades es desen i es poden editar |
| Publicació | Punt creat des de l'administració i consulta posterior a l'app mòbil | Correcte; el punt desat apareix a l'app |
| Retirada | Canvi a `DESACTIVAT` i contrast de l'estat desat a Supabase | Correcte; el registre conserva l'estat `DESACTIVAT` |
| Mapa de l'app | Nova càrrega de l'app després de retirar el punt | Correcte; el punt ja no apareix |

En la primera comprovació després de retirar-lo, el punt encara es veia a causa
de la memòria cau de `/punts`, vàlida fins a l'hora següent. Després de deixar
caducar la memòria cau i tornar a iniciar l'API i l'app, el punt va desaparèixer.
El comportament concorda amb el `Cache-Control` documentat a
[`services/api/src/routes/punts.ts`](../services/api/src/routes/punts.ts).

La comprovació visual correspon a Safari d'escriptori. No s'han registrat la
resolució exacta, captures ni proves en altres navegadors o mides de pantalla.

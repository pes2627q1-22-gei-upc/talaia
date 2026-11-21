# Comprovacions de la UI — TG-178

## Comprovacions automatitzades

Els tests de l'admin simulen Supabase Auth i l'API. Comproven la navegació entre
seccions, la conservació de l'estat, la cerca i el filtre d'usuaris, l'acció de
bloqueig i desbloqueig, la protecció del compte propi i el tractament d'errors.
També comproven la posició de la data i les accions a la taula, i l'ús del
diàleg de confirmació amb el teclat.

Durant la revisió de la tasca s'ha detectat que les columnes de data i accions
estaven intercanviades. S'ha corregit i s'ha afegit una prova de regressió.

## Comprovacions manuals comunicades per la persona responsable

- **Entorn:** web d'administració i API executades en local, app a Expo Go
  (`npm run mobile`) i el mateix projecte Supabase remot compartit que a TG-175.
  No s'han registrat el navegador ni la mida exacta de la finestra.
- Amb un compte administrador a la web i un compte no administrador a l'app,
  el bloqueig des de la web ha acabat mostrant l'avís de compte bloquejat a
  l'app. L'avís no ha aparegut immediatament: en entrar a «Els meus plans»
  s'ha vist un error de càrrega i, en tornar enrere, ha aparegut l'avís.
- En recarregar l'app a Expo Go amb el compte bloquejat, s'ha mostrat l'avís.
  Després de desbloquejar el compte des de la web i recarregar l'app, s'ha
  pogut tornar a entrar mantenint la sessió.
- La cerca i el filtre d'usuaris han funcionat correctament.
- En la revisió visual de la web no s'han detectat problemes en els textos,
  botons ni la resta de controls revisats.
- En una vista estreta del navegador integrat de VS Code s'han revisat les
  seccions d'usuaris i punts i el formulari de punts. Els controls revisats es
  veuen correctament; les taules requereixen desplaçament horitzontal per
  consultar totes les columnes. La persona responsable considera acceptable
  aquest comportament.
- S'ha afegit després una indicació visible quan una taula no cap en l'espai
  disponible. S'ha comprovat visualment a la llista de punts en la vista
  estreta de VS Code; la detecció de desbordament té una prova automatitzada.

El client de l'app detecta el bloqueig quan rep de l'API un `403` amb el codi
`account_blocked`; les rutes públiques no fan aquesta comprovació. No s'ha
confirmat la causa concreta del missatge de càrrega observat a «Els meus plans».

## Límits de la revisió

No s'han registrat captures ni les mides exactes de finestra comprovades; no
consta una comprovació directa del registre a Supabase. Els tests amb jsdom no
comproven solapaments.

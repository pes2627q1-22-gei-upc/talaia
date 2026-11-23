---
paths:
  - "docs/decisions/**"
---

# ADR

- **Número.** El següent lliure, mirant `snapshot` i també totes les branques remotes, perquè dues PR obertes poden agafar el mateix. Ho fa la skill `/nou-adr`.
- **Format.** Context → Decisió → Conseqüències. L'estat és `Proposada` fins que l'equip la valida a la daily, i llavors passa a `Acceptada`. Per canviar una decisió, s'escriu una ADR nova que la substitueix; l'antiga no s'esborra.
- **Índex.** La fila nova va a `docs/decisions/README.md` en ordre numèric. Si la decisió venia de `pendents.md`, s'hi treu.

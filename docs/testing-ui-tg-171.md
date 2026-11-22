# TG-171 · Comprovacions de presentació

- Pantalla de perfil: l'entrada «Punts favorits» es mostra com a botó amb una indicació accessible i obre la llista.
- Llista: a una amplada de referència de 320 pt, els tests comproven capçalera, botó enrere, nom i municipi de cada punt, límits de línies del text i disposició de la fila amb espai flexible per al text. També comproven que una fila obre la fitxa corresponent.
- Estats: hi ha proves de llista buida i de fallada amb botó de reintent. La càrrega mostra esquelets amb l'alçada de les files.
- Comprovació automàtica: `npm test -w apps/mobile -- --runInBand --runTestsByPath src/features/profile/__tests__/FavoritesScreen.test.tsx src/features/profile/__tests__/ProfileScreen.test.tsx`, `npx tsc --noEmit -p apps/mobile/tsconfig.json` i `npm run lint -w apps/mobile -- --quiet`.
- Pendent de comprovació visual en dispositiu: els tests de React Native no calculen la posició real dels elements. Cal revisar en iOS i Android que ni el títol, ni el botó enrere, ni els noms llargs queden tapats, també amb text ampliat i en mode nit.

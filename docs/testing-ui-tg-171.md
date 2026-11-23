# TG-171 · Comprovacions de presentació

- Pantalla de perfil: l'entrada «Punts favorits» es mostra com a botó amb una indicació accessible i obre la llista.
- Llista: a una amplada de referència de 320 pt, els tests comproven capçalera, botó enrere, nom i municipi de cada punt, límits de línies del text i disposició de la fila amb espai flexible per al text. També comproven que una fila obre la fitxa corresponent.
- Refinament visual: la prova comprova les targetes, el recompte de llocs i el tema vermell. L'índex horari no apareix a la llista: es consulta a la fitxa del punt.
- La zona del text és l'únic botó de cada targeta. El cor ocupa més de 44 pt en una zona pròpia, sense separador visual; ara és decoratiu i tocar-lo no navega ni elimina el favorit. Després de revisar una captura en un iPhone, s'ha corregit l'estirament vertical del bloc de text que deixava el nom arran de dalt.
- La targeta mostra el cor decoratiu a l'esquerra, el municipi amb la icona de ubicació i una fletxa a la dreta, dins de l'accés a la fitxa. El text queda centrat verticalment i el cor manté la seva zona independent sense requadre.
- Estats: hi ha proves de llista buida i de fallada amb botó de reintent. La càrrega mostra esquelets amb l'alçada de les files.
- Comprovació automàtica: `npm test -w apps/mobile -- --runInBand --runTestsByPath src/features/profile/__tests__/FavoritesScreen.test.tsx src/features/profile/__tests__/ProfileScreen.test.tsx`, `npx tsc --noEmit -p apps/mobile/tsconfig.json` i `npm run lint -w apps/mobile -- --quiet`.
- Comprovació visual confirmada per Vinyet: iPhone amb iOS 26.6.4, text a la mida per defecte, pantalla en català amb quatre favorits. La llista final amb el cor a l'esquerra, el municipi amb icona i la fletxa a la dreta es mostra sense elements tapats ni superposicions comunicades.
- Pendent de comprovació visual: Android, text ampliat, idiomes es/en i estats buit i d'error a Expo Go. Els tests de React Native no calculen la posició real dels elements.

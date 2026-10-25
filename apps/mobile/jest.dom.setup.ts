// Tests de les DOM components (preset web, jsdom). jsdom no té `matchMedia`, i Reanimated el consulta
// en carregar-se (hi arriba pels tokens del tema).
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

/**
 * Mode nit als mapes (ADR-0032). Les DOM components no veuen el context del tema: reben `night`.
 *
 * Només el canvas de MapLibre (les tessel·les de l'ICGC, el relleu i les capes que s'hi dibuixen)
 * passa a escala de grisos, i a sobre de tot hi ha una capa vermella en `multiply`. Així cada píxel
 * del canvas queda amb la seva lluminositat al canal vermell, sense tocar l'estil. Els marcadors
 * HTML, l'atribució i els controls queden fora del filtre i reben la paleta vermella: el gris els
 * apagaria (`#FF0000` → `#360000`), i el `multiply` no canvia cap color que només tingui vermell.
 * Per això les capes del canvas reben la paleta normal, i la resta, la del tema.
 */
export const NIGHT_MAP_CSS = '.maplibregl-canvas { filter: grayscale(1); }';

export const NIGHT_MAP_TINT = {
  inset: 0,
  // `colorsVermell.lluna`: tokens.ts porta reanimated, i aquest fitxer va dins del WebView.
  background: '#FF0000',
  mixBlendMode: 'multiply',
  pointerEvents: 'none',
  // Per sobre dels controls de MapLibre (`z-index: 2`): si no, una caixa blanca hi quedava a sota.
  zIndex: 10,
} as const;

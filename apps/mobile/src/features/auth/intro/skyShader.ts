import { Skia } from '@shopify/react-native-skia';

import { colors, gradients } from '@/core/theme/tokens';

/**
 * El cel de la intro en un sol shader (SkSL, a la GPU): el degradat de la marca, la Via Làctia
 * amb pols i franges fosques, tres capes d'estels procedurals que parpellegen i es mouen amb el
 * giroscopi, l'ona que els encén des de la torre i el feix volumètric del far, que els aviva.
 * Totes les coordenades són píxels de la pantalla.
 */
const SKSL = `
uniform float2 res;
uniform float time;
uniform float open;
uniform float milky;
uniform float2 center;
uniform float2 par;
uniform float zoom;
uniform float beamA;
uniform float beamI;
uniform float horizon;
uniform float3 cTop;
uniform float3 cMid;
uniform float3 cBottom;
uniform float3 cDustA;
uniform float3 cDustB;
uniform float3 cStar;
uniform float3 cBeam;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Una capa d'estels: com a molt un per cel·la de la graella, amb mida, brillantor i ritme propis.
float stars(float2 p, float cell, float density, float t) {
  float2 g = floor(p / cell);
  float h = hash(g);
  if (h > density) { return 0.0; }
  float2 pos = (g + float2(hash(g + 7.1), hash(g + 3.7)) * 0.8 + 0.1) * cell;
  float d = length(p - pos);
  float size = mix(0.55, 1.5, hash(g + 1.3));
  float twinkle = 0.6 + 0.4 * sin(t * (0.5 + hash(g + 9.2) * 1.7) + h * 40.0);
  float core = smoothstep(size, 0.0, d);
  float halo = exp(-d * d / (size * size * 10.0)) * 0.35;
  // L'ona que surt de la torre i encén els estels a mesura que arriba.
  float r = length(pos - center) / length(res);
  float reveal = smoothstep(r, r + 0.12, open * 1.2);
  return (core + halo) * twinkle * reveal * mix(0.35, 1.0, hash(g + 5.5));
}

half4 main(float2 xy) {
  // El salt final apropa el cel cap a l'estel de la torre.
  float2 p = (xy - center) / zoom + center;
  float y = xy.y / res.y;
  float3 col = mix(cTop, cMid, smoothstep(0.0, 0.58, y));
  col = mix(col, cBottom, smoothstep(0.58, 1.0, y));
  float3 base = col;

  // Via Làctia: una banda que puja cap a la dreta per darrere la torre.
  float2 q = (p + par * 0.25) / res.x;
  float2 dir = normalize(float2(1.0, -0.62));
  float2 origin = float2(0.5, 0.36 * res.y / res.x);
  float across = dot(q - origin, float2(-dir.y, dir.x));
  float along = dot(q - origin, dir);
  float n = fbm(q * 4.0 + float2(time * 0.015, time * 0.006));
  float n2 = fbm(q * 9.0 - float2(time * 0.01, 0.0));
  float width = 0.1 + 0.05 * n;
  float band = exp(-(across * across) / (width * width)) * smoothstep(0.95, 0.15, abs(along));
  float dust = band * (0.2 + 0.8 * n) * (0.6 + 0.4 * n2);
  float lanes = band * smoothstep(0.55, 0.78, n2);
  col += mix(cDustA, cDustB, smoothstep(0.35, 0.85, n)) * dust * 0.5 * milky;
  col -= col * lanes * 0.35 * milky;

  // Feix del far: un con de llum que surt de l'estel de la torre.
  float2 v = xy - center;
  float ang = atan(v.y, v.x);
  float da = abs(ang - beamA);
  da = min(da, 6.2831853 - da);
  float dist = length(v);
  float cone = smoothstep(0.17, 0.0, da) * smoothstep(8.0, 60.0, dist) * exp(-dist / 650.0);
  float beam = cone * beamI;
  col += cBeam * beam * (0.32 + 0.18 * n);

  // Estels: llunyans, mitjans i la pols d'estels de dins la Via Làctia.
  float s = stars(p + par * 0.35, 34.0, 0.55, time) * 0.7
          + stars(p + par, 61.0, 0.5, time + 3.0)
          + stars(p + par * 0.6 + 17.0, 21.0, 0.4, time + 7.0) * (0.15 + band * 1.6 * milky);
  col += cStar * s * (1.0 + beam * 2.5);

  // Per sota del turó ja no és cel: només el degradat, perquè el text es llegeixi bé.
  col = mix(base, col, 1.0 - smoothstep(horizon - 24.0, horizon, xy.y));

  return half4(col, 1.0);
}
`;

export const skyEffect = Skia.RuntimeEffect.Make(SKSL);

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Colors del shader: tots surten dels tokens. La pols de la Via Làctia va de `boira` a `far`. */
export const SKY_COLORS = {
  cTop: rgb(gradients.cel.colors[0]),
  cMid: rgb(gradients.cel.colors[1]),
  cBottom: rgb(gradients.cel.colors[2]),
  cDustA: rgb(colors.boira),
  cDustB: rgb(colors.far),
  cStar: rgb(colors.lluna),
  cBeam: rgb(colors.far),
} as const;

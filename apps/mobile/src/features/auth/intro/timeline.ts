import { Easing } from 'react-native-reanimated';

/**
 * Guió de la intro de la benvinguda (ms), com una línia de temps de GSAP: un sol rellotge `t`
 * i cada peça calcula el seu estat a partir de `t`. Saltar-la és portar `t` a `end`.
 */
export const TL = {
  /** Un sol estel batega en la foscor. */
  heartbeat: 0,
  /** El cel s'obre des de la torre: els estels s'encenen en ona. */
  open: 400,
  openFor: 1300,
  /** La Via Làctia es desplega. */
  milky: 1000,
  milkyFor: 1400,
  glow: 1500,
  hill: 1550,
  /** La torre s'alça de darrere el turó. */
  tower: 1650,
  towerFor: 900,
  /** L'estel de la torre s'encén amb un esclat. */
  ignite: 2050,
  window: 2250,
  /** El feix del far escombra el cel de dreta a esquerra. */
  beam: 2500,
  beamFor: 1100,
  /** Cassiopea es dibuixa quan el feix hi passa per sobre. */
  constellation: 3150,
  constellationFor: 650,
  logo: 3350,
  logoFor: 700,
  /** El contingut entra en cascada. */
  content: 3550,
  contentStagger: 60,
  contentFor: 550,
  end: 4500,
} as const;

/** Quan comença la intro: sencera el primer cop; curta (el final) les altres; quieta si cal. */
export type IntroMode = 'full' | 'short' | 'still';

/** Les altres vegades només es veu el final: el feix ja ha passat, el logotip i el contingut entren. */
export const SHORT_START = TL.logo - 200;

export function introStart(mode: IntroMode): number {
  if (mode === 'full') return 0;
  if (mode === 'short') return SHORT_START;
  return TL.end;
}

// Corbes de GSAP com a funcions (no fàbriques) perquè es puguin cridar dins dels worklets.
export const curve = {
  expoOut: Easing.bezierFn(0.16, 1, 0.3, 1),
  power2Out: Easing.bezierFn(0.215, 0.61, 0.355, 1),
  backOut: Easing.bezierFn(0.34, 1.56, 0.64, 1),
  sineInOut: Easing.bezierFn(0.37, 0, 0.63, 1),
};

/** Progrés 0–1 d'una peça que comença a `start` i dura `duration`, ja passat per la corba. */
export function beat(t: number, start: number, duration: number, easing?: (x: number) => number) {
  'worklet';
  const p = Math.min(1, Math.max(0, (t - start) / duration));
  return easing ? easing(p) : p;
}

/** Angle del feix (graus): de -15° (amunt a la dreta) a -165° (amunt a l'esquerra). */
export function beamAngle(t: number) {
  'worklet';
  return -15 - 150 * beat(t, TL.beam, TL.beamFor, curve.sineInOut);
}

/** Intensitat del feix: s'encén, escombra i s'apaga. */
export function beamIntensity(t: number) {
  'worklet';
  const p = beat(t, TL.beam, TL.beamFor);
  return Math.min(1, p * 6) * Math.min(1, (1 - p) * 4);
}

/** L'esclat de l'estel de la torre: puja de cop i s'assenta en un resplendor que respira. */
export function flare(t: number) {
  'worklet';
  const p = beat(t, TL.ignite, 900);
  if (p <= 0) return 0;
  const burst = Math.exp(-p * 5) * Math.min(1, p * 12);
  return 0.35 + 1.4 * burst;
}

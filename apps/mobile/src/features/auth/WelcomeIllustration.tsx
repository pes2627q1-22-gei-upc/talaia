import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { beat, curve, TL } from './intro/timeline';

/**
 * La torre de la benvinguda, damunt del cel de Skia: les peces del frame «01 Benvinguda i accés»
 * del Figma, a la mateixa posició (coordenades d'un frame de 393 d'amplada) multiplicades per
 * `scale`. Tot es mou amb la línia de temps de la intro (`t`).
 */
export const ILLUSTRATION = {
  width: 393,
  /** On acaba el turó. */
  height: 420,
  /** El contingut comença a 388: el logotip trepitja el turó. */
  contentOverlap: 32,
  /** On comença la torre amb l'estel. El que hi ha a sobre és cel i es pot retallar. */
  towerTop: 130,
} as const;

type Screen = { width: number; height: number; topInset: number };

/**
 * Escala de la il·lustració: la de l'amplada de la pantalla, o menys si la pantalla és tan baixa
 * que la torre quedaria tallada per dalt o sota la barra d'estat (iPhone SE, Android petits).
 */
export function illustrationScale({ width, height, topInset }: Screen, contentHeight: number) {
  const visible = ILLUSTRATION.height - ILLUSTRATION.contentOverlap - ILLUSTRATION.towerTop;
  return Math.min(width / ILLUSTRATION.width, (height - topInset - contentHeight) / visible);
}

/**
 * Distàncies del Figma (punts del frame de 393) que recorren les peces en entrar. La torre surt
 * de prou avall perquè ni els merlets (a 210) es vegin abans d'hora.
 */
const TRAVEL = { hill: 30, tower: 215 } as const;

const resplendor = require('@/assets/images/welcome/resplendor.svg');
const turo = require('@/assets/images/welcome/turo.svg');

/** El grup «Talaia» (node 3:50) i els seus vectors, en coordenades del grup. */
const TOWER = { x: 55.7, y: 130, size: 281.6 } as const;
const TOWER_PARTS = [
  {
    name: 'merlet-1',
    source: require('@/assets/images/welcome/torre/merlet.svg'),
    x: 101.2,
    y: 80.3,
    w: 15.4,
    h: 18.7,
  },
  {
    name: 'merlet-2',
    source: require('@/assets/images/welcome/torre/merlet.svg'),
    x: 133.1,
    y: 80.3,
    w: 15.4,
    h: 18.7,
  },
  {
    name: 'merlet-3',
    source: require('@/assets/images/welcome/torre/merlet.svg'),
    x: 165,
    y: 80.3,
    w: 15.4,
    h: 18.7,
  },
  {
    name: 'muralla',
    source: require('@/assets/images/welcome/torre/muralla.svg'),
    x: 101.2,
    y: 94.6,
    w: 79.2,
    h: 14.3,
  },
  {
    name: 'cos',
    source: require('@/assets/images/welcome/torre/cos.svg'),
    x: 96.8,
    y: 106.7,
    w: 88,
    h: 135.3,
  },
] as const;
const WINDOW = {
  source: require('@/assets/images/welcome/torre/finestra.svg'),
  x: 133.65,
  y: 127.6,
  w: 14.3,
  h: 28.6,
} as const;
const TOWER_STAR = {
  source: require('@/assets/images/welcome/torre/estel.svg'),
  x: 108.9,
  y: 7.7,
  w: 63.8,
  h: 63.8,
} as const;

/** La finestra s'encén com un fanal: un parpelleig i després una llum que respira. */
export function windowLight(t: number, clock: number, still: boolean) {
  'worklet';
  const ms = t - TL.window;
  if (ms <= 0) return 0;
  let light = 1;
  if (ms < 90) light = ms / 90;
  else if (ms < 180) light = 1 - 0.65 * ((ms - 90) / 90);
  else if (ms < 340) light = 0.35 + 0.65 * ((ms - 180) / 160);
  const breath = still
    ? 0
    : 0.09 * (1 + Math.sin((clock / 3600) * Math.PI * 2)) * beat(t, TL.end - 400, 400);
  return light - breath;
}

type WelcomeIllustrationProps = {
  scale: number;
  screenWidth: number;
  /** Distància fins a baix de la pantalla on ha de quedar el peu de la il·lustració. */
  bottom: number;
  t: SharedValue<number>;
  clock: SharedValue<number>;
  /** De 0 a 1 en triar una opció: la torre s'esvaeix mentre el cel salta cap a l'estel. */
  exit: SharedValue<number>;
  still: boolean;
};

export function WelcomeIllustration(props: WelcomeIllustrationProps) {
  const { scale, screenWidth, bottom, t, clock, exit, still } = props;

  const sceneStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ scale: 1 + 0.12 * exit.get() }],
  }));
  const glowStyle = useAnimatedStyle(() => {
    const now = t.get();
    const grow = beat(now, TL.glow, 900, curve.expoOut);
    const pulse = beat(now, TL.ignite, 250) * (1 - beat(now, TL.ignite + 250, 700));
    const breath = still
      ? 0
      : Math.sin((clock.get() / 4000) * Math.PI * 2) * beat(now, TL.end - 400, 400);
    return {
      opacity: Math.min(1, grow * (0.85 + 0.15 * breath)),
      transform: [{ scale: 0.6 + 0.4 * grow + 0.08 * pulse + 0.03 * breath }],
    };
  });
  const hillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - beat(t.get(), TL.hill, 700, curve.expoOut)) * TRAVEL.hill * scale },
    ],
  }));
  const towerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          (1 - beat(t.get(), TL.tower, TL.towerFor, curve.expoOut)) * TRAVEL.tower * scale,
      },
    ],
  }));
  const windowStyle = useAnimatedStyle(() => ({
    opacity: windowLight(t.get(), clock.get(), still),
  }));
  const starStyle = useAnimatedStyle(() => {
    const now = t.get();
    const ignite = beat(now, TL.ignite, 700, curve.backOut);
    const turn = -120 * (1 - beat(now, TL.ignite, 900, curve.expoOut));
    const alive = still ? 0 : beat(now, TL.end - 400, 400);
    const seconds = clock.get() / 1000;
    const breath = Math.sin((seconds / 2.8) * Math.PI * 2) * alive;
    const sway = 4 * Math.sin((seconds / 3.6) * Math.PI * 2) * alive;
    return {
      opacity: Math.min(1, ignite * 2),
      transform: [
        { rotate: `${turn + sway}deg` },
        { scale: (0.2 + 0.8 * ignite) * (1 + 0.07 * breath) * (1 + 0.6 * exit.get()) },
      ],
    };
  });

  const width = ILLUSTRATION.width * scale;
  // Si la il·lustració s'ha d'encongir (pantalles baixes), queda centrada; el turó, en canvi,
  // ocupa sempre tota l'amplada (el seu SVG es pot estirar: `preserveAspectRatio="none"`).
  const left = (screenWidth - width) / 2;
  const at = (x: number, y: number, w: number, h: number) => ({
    left: x * scale,
    top: y * scale,
    width: w * scale,
    height: h * scale,
  });

  return (
    <Animated.View
      testID="welcome-illustration"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { left, bottom, width, height: ILLUSTRATION.height * scale }, sceneStyle]}
    >
      <Animated.View style={[styles.layer, at(-63, 240, 520, 300), glowStyle]}>
        <Image source={resplendor} contentFit="fill" style={styles.fill} />
      </Animated.View>

      <Animated.View
        style={[styles.layer, at(TOWER.x, TOWER.y, TOWER.size, TOWER.size), towerStyle]}
      >
        {TOWER_PARTS.map((part) => (
          <Image
            key={part.name}
            source={part.source}
            contentFit="fill"
            style={[styles.layer, at(part.x, part.y, part.w, part.h)]}
          />
        ))}
        <Animated.View
          style={[styles.layer, at(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h), windowStyle]}
        >
          <Image source={WINDOW.source} contentFit="fill" style={styles.fill} />
        </Animated.View>
        <Animated.View
          style={[
            styles.layer,
            at(TOWER_STAR.x, TOWER_STAR.y, TOWER_STAR.w, TOWER_STAR.h),
            starStyle,
          ]}
        >
          <Image source={TOWER_STAR.source} contentFit="fill" style={styles.fill} />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.layer,
          { left: -left, top: 366 * scale, width: screenWidth, height: 54 * scale },
          hillStyle,
        ]}
      >
        <Image source={turo} contentFit="fill" style={styles.fill} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // La torre surt de darrere el turó: el que queda per sota del turó no es veu.
  box: { position: 'absolute', overflow: 'hidden' },
  layer: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
});

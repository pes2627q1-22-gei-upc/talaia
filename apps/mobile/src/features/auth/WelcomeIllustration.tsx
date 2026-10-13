import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion } from '@/core/theme/tokens';

import { STARS } from './stars';

/**
 * Il·lustració de la benvinguda: les peces del frame «01 Benvinguda i accés» del Figma, a la
 * mateixa posició (coordenades d'un frame de 393 d'amplada) i multiplicades per `scale`.
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
 * Guió de l'entrada, en ms, com una línia de temps de GSAP: cada peça comença quan toca i se
 * superposa amb l'anterior. A `settle` acaba l'entrada i comencen les animacions de fons.
 */
export const TIMELINE = {
  stars: 0,
  glow: 100,
  hill: 150,
  tower: 250,
  star: 650,
  window: 800,
  settle: 1400,
  meteor: 1800,
  meteorEvery: 6000,
} as const;

/** Distàncies del Figma (punts del frame de 393) que recorren les peces en entrar. */
const TRAVEL = { hill: 30, tower: 170, meteorX: 64, meteorY: 48 } as const;

const resplendor = require('@/assets/images/welcome/resplendor.svg');
const estelsFugacos = require('@/assets/images/welcome/estels-fugacos.svg');
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

/** Pseudoaleatori estable: cada estel té sempre el mateix ritme, render rere render. */
function noise(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const sine = { easing: motion.ease.sineInOut };

type StarProps = (typeof STARS)[number] & { index: number; scale: number; still: boolean };

/** Un estel: s'encén en un moment aleatori de la primera part i després parpelleja al seu ritme. */
function Star({ x, y, r, o, index, scale, still }: StarProps) {
  const opacity = useSharedValue(still ? o : 0);

  useEffect(() => {
    if (still) return;
    const half = 1400 + noise(index, 2) * 1600;
    opacity.set(
      withSequence(
        withDelay(
          TIMELINE.stars + noise(index, 1) * 900,
          withTiming(o, { duration: 600, easing: motion.ease.power2Out }),
        ),
        withRepeat(
          withSequence(
            withTiming(o * 0.3, { duration: half, ...sine }),
            withTiming(o, { duration: half, ...sine }),
          ),
          -1,
        ),
      ),
    );
  }, [index, o, opacity, still]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const size = 2 * r * scale;
  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: (x - r) * scale,
          top: (y - r) * scale,
          width: size,
          height: size,
          borderRadius: size,
        },
        style,
      ]}
    />
  );
}

type WelcomeIllustrationProps = {
  scale: number;
  screenWidth: number;
  /** Distància fins a baix de la pantalla on ha de quedar el peu de la il·lustració. */
  bottom: number;
  /** De 0 a 1 quan l'usuari tria una opció: el cel s'apropa i l'estel fa un esclat. */
  exit: SharedValue<number>;
};

export function WelcomeIllustration({
  scale,
  screenWidth,
  bottom,
  exit,
}: WelcomeIllustrationProps) {
  const still = useReducedMotion();
  const done = still ? 1 : 0;

  const glowIn = useSharedValue(done);
  const glowPulse = useSharedValue(0);
  const glowBreath = useSharedValue(0);
  const hillIn = useSharedValue(done);
  const towerIn = useSharedValue(done);
  const windowLight = useSharedValue(done);
  const starIn = useSharedValue(done);
  const starTurn = useSharedValue(still ? 0 : -120);
  const starBreath = useSharedValue(0);
  const starSway = useSharedValue(0);
  const meteor = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    const expo = (duration: number) => ({ duration, easing: motion.ease.expoOut });
    const loop = (amplitude: number, duration: number) =>
      withDelay(
        TIMELINE.settle,
        withRepeat(
          withSequence(
            withTiming(amplitude, { duration, ...sine }),
            withTiming(-amplitude, { duration, ...sine }),
          ),
          -1,
          true,
        ),
      );

    glowIn.set(withDelay(TIMELINE.glow, withTiming(1, expo(900))));
    glowPulse.set(
      withDelay(
        TIMELINE.star,
        withSequence(
          withTiming(1, { duration: 250, easing: motion.ease.power2Out }),
          withTiming(0, { duration: 700, ...sine }),
        ),
      ),
    );
    glowBreath.set(loop(1, 4000));
    hillIn.set(withDelay(TIMELINE.hill, withTiming(1, expo(700))));
    towerIn.set(withDelay(TIMELINE.tower, withTiming(1, expo(900))));
    // La finestra s'encén com un fanal: un parpelleig i després una llum que respira.
    windowLight.set(
      withDelay(
        TIMELINE.window,
        withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(0.35, { duration: 90 }),
          withTiming(1, { duration: 160 }),
          withRepeat(
            withSequence(
              withTiming(0.82, { duration: 1800, ...sine }),
              withTiming(1, { duration: 1800, ...sine }),
            ),
            -1,
          ),
        ),
      ),
    );
    starIn.set(
      withDelay(TIMELINE.star, withTiming(1, { duration: 700, easing: motion.ease.backOut })),
    );
    starTurn.set(withDelay(TIMELINE.star, withTiming(0, expo(900))));
    starBreath.set(loop(1, 2800));
    starSway.set(loop(4, 3600));
    meteor.set(
      withDelay(
        TIMELINE.meteor,
        withRepeat(
          withSequence(
            withTiming(1, expo(1100)),
            withDelay(TIMELINE.meteorEvery - 1100, withTiming(0, { duration: 0 })),
          ),
          -1,
        ),
      ),
    );
  }, [
    still,
    glowIn,
    glowPulse,
    glowBreath,
    hillIn,
    towerIn,
    windowLight,
    starIn,
    starTurn,
    starBreath,
    starSway,
    meteor,
  ]);

  const sceneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.05 * exit.get() }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, glowIn.get() * (0.85 + 0.15 * glowBreath.get()) + 0.3 * exit.get()),
    transform: [
      { scale: 0.6 + 0.4 * glowIn.get() + 0.08 * glowPulse.get() + 0.03 * glowBreath.get() },
    ],
  }));
  const hillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - hillIn.get()) * TRAVEL.hill * scale }],
  }));
  const towerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - towerIn.get()) * TRAVEL.tower * scale }],
  }));
  const windowStyle = useAnimatedStyle(() => ({ opacity: windowLight.get() }));
  const starStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, starIn.get() * 2),
    transform: [
      { rotate: `${starTurn.get() + starSway.get()}deg` },
      {
        scale: (0.2 + 0.8 * starIn.get()) * (1 + 0.07 * starBreath.get()) * (1 + 0.5 * exit.get()),
      },
    ],
  }));
  const meteorStyle = useAnimatedStyle(() => {
    const p = meteor.get();
    return {
      opacity: interpolate(p, [0, 0.12, 0.6, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: (p * TRAVEL.meteorX - TRAVEL.meteorX * 0.75) * scale },
        { translateY: (p * TRAVEL.meteorY - TRAVEL.meteorY * 0.75) * scale },
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

      {STARS.map((star, index) => (
        <Star key={index} {...star} index={index} scale={scale} still={still} />
      ))}

      <Animated.View style={[styles.layer, at(0, 0, 393, 200), meteorStyle]}>
        <Image source={estelsFugacos} contentFit="fill" style={styles.fill} />
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
  star: { position: 'absolute', backgroundColor: colors.lluna },
});

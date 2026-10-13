import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { motion } from '@/core/theme/tokens';

/**
 * Il·lustració de la benvinguda: les capes del frame «01 Benvinguda i accés» del Figma, a la
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

const LAYERS = [
  {
    name: 'resplendor',
    source: require('@/assets/images/welcome/resplendor.svg'),
    x: -63,
    y: 240,
    w: 520,
    h: 300,
  },
  {
    name: 'estels',
    source: require('@/assets/images/welcome/estels.svg'),
    x: 1.17,
    y: 12.97,
    w: 391.979,
    h: 336.38,
  },
  {
    name: 'estels-fugacos',
    source: require('@/assets/images/welcome/estels-fugacos.svg'),
    x: 0,
    y: 0,
    w: 393,
    h: 200,
  },
  {
    name: 'talaia',
    source: require('@/assets/images/welcome/talaia.svg'),
    x: 55.7,
    y: 130,
    w: 281.6,
    h: 281.6,
  },
] as const;

const HILL = { source: require('@/assets/images/welcome/turo.svg'), y: 366, h: 54 } as const;

type WelcomeIllustrationProps = {
  scale: number;
  screenWidth: number;
  /** Distància fins a baix de la pantalla on ha de quedar el peu de la il·lustració. */
  bottom: number;
};

export function WelcomeIllustration({ scale, screenWidth, bottom }: WelcomeIllustrationProps) {
  const width = ILLUSTRATION.width * scale;
  // Si la il·lustració s'ha d'encongir (pantalles baixes), queda centrada; el turó, en canvi,
  // ocupa sempre tota l'amplada (el seu SVG es pot estirar: `preserveAspectRatio="none"`).
  const left = (screenWidth - width) / 2;

  return (
    <Animated.View
      testID="welcome-illustration"
      entering={FadeIn.duration(motion.slow).easing(motion.enter)}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { left, bottom, width, height: ILLUSTRATION.height * scale }]}
    >
      {LAYERS.map((layer) => (
        <Image
          key={layer.name}
          source={layer.source}
          contentFit="fill"
          style={[
            styles.layer,
            {
              left: layer.x * scale,
              top: layer.y * scale,
              width: layer.w * scale,
              height: layer.h * scale,
            },
          ]}
        />
      ))}
      <Image
        source={HILL.source}
        contentFit="fill"
        style={[
          styles.layer,
          { left: -left, top: HILL.y * scale, width: screenWidth, height: HILL.h * scale },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  layer: { position: 'absolute' },
});

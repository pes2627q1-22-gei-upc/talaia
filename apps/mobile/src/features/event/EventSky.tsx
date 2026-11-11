import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, gradients, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';

const radiant = require('@/assets/images/event/radiant.svg');

const STARS = 30;
/** Estels i estrelles fugaces: dibuix, no són tokens. */
const STAR_SIZE = { min: 1, max: 2.4 };
const METEOR_WIDTH = 1.5;
/** Direcció (graus), distància al radiant i llargada de cada estrella fugaç. */
const METEORS = [
  { angle: 14, gap: 24, length: 52 },
  { angle: 58, gap: 22, length: 34 },
  { angle: 148, gap: 26, length: 44 },
  { angle: 198, gap: 30, length: 26 },
] as const;

/** Generador pseudoaleatori amb llavor (mulberry32): el mateix esdeveniment, el mateix cel. */
function random(seed: string) {
  let state = [...seed].reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619),
    2166136261,
  );
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

type EventSkyProps = {
  seed: string;
  icon: ImageSource;
  /** Pluges d'estels: les estrelles fugaces surten del radiant. */
  meteors: boolean;
  caption: string;
};

/** Targeta del cel de la fitxa (mockup 09): el radiant amb la icona del fenomen, sobre l'horitzó. */
export function EventSky({ seed, icon, meteors, caption }: EventSkyProps) {
  const stars = useMemo(() => {
    const next = random(seed);
    return Array.from({ length: STARS }, () => {
      const size = STAR_SIZE.min + next() * (STAR_SIZE.max - STAR_SIZE.min);
      return {
        left: `${(next() * 100).toFixed(1)}%` as const,
        top: `${(next() * 92).toFixed(1)}%` as const,
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity: 0.3 + next() * 0.65,
      };
    });
  }, [seed]);

  return (
    <View style={styles.card} accessible accessibilityRole="image" accessibilityLabel={caption}>
      <LinearGradient
        colors={gradients.eventSky.colors}
        locations={gradients.eventSky.locations}
        style={StyleSheet.absoluteFill}
      />
      {stars.map((star, index) => (
        <View key={index} style={[styles.star, star]} />
      ))}
      <View style={styles.radiant}>
        {meteors
          ? METEORS.map(({ angle, gap, length }) => (
              <LinearGradient
                key={angle}
                colors={['transparent', colors.lluna]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.meteor,
                  { width: length, transform: [{ rotate: `${angle}deg` }, { translateX: gap }] },
                ]}
              />
            ))
          : null}
        <Image source={radiant} style={styles.ring} accessible={false} />
        {/* La icona del fenomen, en `far` com al mockup. */}
        <Image source={icon} tintColor={colors.far} style={styles.icon} accessible={false} />
      </View>
      <LinearGradient
        colors={gradients.eventHorizon.colors}
        locations={gradients.eventHorizon.locations}
        style={styles.horizon}
      />
      <AppText variant="tag" color="boira" style={styles.caption} numberOfLines={1}>
        {caption}
      </AppText>
    </View>
  );
}

const half = sizes.eventRadiant / 2;

const styles = StyleSheet.create({
  card: {
    height: sizes.eventSky,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.linia,
    overflow: 'hidden',
  },
  star: { position: 'absolute', backgroundColor: colors.lluna },
  // On el posa el mockup: una mica a l'esquerra del centre, prop de dalt.
  radiant: {
    position: 'absolute',
    left: '37%',
    top: spacing.xs,
    width: sizes.eventRadiant,
    height: sizes.eventRadiant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', width: sizes.eventRadiant, height: sizes.eventRadiant },
  icon: { width: sizes.iconSmall, height: sizes.iconSmall },
  meteor: {
    position: 'absolute',
    left: half,
    top: half - METEOR_WIDTH / 2,
    height: METEOR_WIDTH,
    borderRadius: METEOR_WIDTH,
    transformOrigin: 'left center',
  },
  horizon: { position: 'absolute', left: 0, right: 0, bottom: 0, height: sizes.eventHorizon },
  caption: { position: 'absolute', right: spacing.ms, bottom: spacing.sm, maxWidth: '60%' },
});

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients, motion, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';

import { SkyCanvas, type Tap } from './intro/SkyCanvas';
import { beat, curve, introStart, TL } from './intro/timeline';
import { useAmbientClock } from './intro/useAmbientClock';
import { useIntro } from './intro/useIntro';
import { useWelcomeViewModel } from './useWelcomeViewModel';
import { ILLUSTRATION, illustrationScale, WelcomeIllustration } from './WelcomeIllustration';

const logotip = require('@/assets/images/welcome/logotip.svg');
const sparkStar = require('@/assets/images/welcome/torre/estel.svg');
const mailIcon = require('@/assets/images/welcome/mail.svg');

/** Mides del logotip del Figma i de l'estel de la «i» (Vector_7 de `logotip.svg`). */
const LOGO = { width: 190, height: 77, star: { x: 141.68, y: 10.5, size: 18 } } as const;

/** El contingut entra en cascada quan la intro hi arriba (o de seguida, si se salta). */
function Appear({
  index,
  t,
  children,
}: {
  index: number;
  t: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const p = beat(t.get(), TL.content + index * TL.contentStagger, TL.contentFor, curve.expoOut);
    return { opacity: p, transform: [{ translateY: (1 - p) * spacing.ms }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** El logotip puja des de sota el seu propi marc i l'estel de la «i» fa una espurna. */
function Logo({ t, label }: { t: SharedValue<number>; label: string }) {
  const reveal = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - beat(t.get(), TL.logo, TL.logoFor, curve.expoOut)) * LOGO.height },
    ],
  }));
  const spark = useAnimatedStyle(() => {
    const p = beat(t.get(), TL.logo + 450, 550);
    const flash = Math.sin(Math.PI * p);
    return {
      opacity: flash,
      transform: [{ rotate: `${90 * p}deg` }, { scale: 0.4 + 1.4 * flash }],
    };
  });
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={label} style={styles.logo}>
      <View style={styles.logoMask}>
        <Animated.View style={reveal}>
          <Image source={logotip} style={styles.logo} />
        </Animated.View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.spark, spark]}>
        <Image source={sparkStar} style={styles.fill} />
      </Animated.View>
    </View>
  );
}

/** Benvinguda i accés (HU35, mockup 01). La sessió arriba amb TG-81 i TG-83. */
export function WelcomeScreen() {
  const vm = useWelcomeViewModel();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);
  const { intro } = useLocalSearchParams<{ intro?: string }>();
  const { mode, t, skip } = useIntro(intro === 'sencera');
  const clock = useAmbientClock();
  const still = mode === 'still';

  const scale = illustrationScale({ width, height, topInset: insets.top }, contentHeight);
  const bottom = contentHeight - ILLUSTRATION.contentOverlap * scale;
  const box = {
    left: (width - ILLUSTRATION.width * scale) / 2,
    top: height - bottom - ILLUSTRATION.height * scale,
    scale,
  };

  // Tocar el cel: durant la intro, la salta; després, en fa sortir un estel fugaç.
  const tap = useSharedValue<Tap | null>(null);
  const touchSky = (x: number, y: number) => {
    if (t.get() < TL.end) skip();
    else if (!still) tap.set({ x, y, at: clock.get() });
  };

  // En triar una opció: salt a la velocitat de la llum cap a l'estel de la torre i, després, l'app.
  const exit = useSharedValue(0);
  const leaving = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => leaving.current.forEach(clearTimeout), []);
  const leave = (action: () => void) => {
    if (leaving.current.length > 0) return;
    const duration = still ? motion.fast : motion.leave;
    exit.set(withTiming(1, { duration, easing: still ? motion.exit : curve.sineInOut }));
    leaving.current = [setTimeout(action, duration)];
    if (!still) {
      const flash = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      leaving.current.push(setTimeout(flash, duration * 0.65));
    }
  };
  const contentStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, exit.get() * 2.5),
    transform: [{ translateY: still ? 0 : exit.get() * spacing.lg }],
  }));

  const ready = mode !== null && contentHeight > 0;

  return (
    <LinearGradient
      colors={gradients.cel.colors}
      locations={gradients.cel.locations}
      style={styles.root}
    >
      {ready ? (
        <Pressable
          testID="welcome-sky"
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={(event) => touchSky(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        >
          <SkyCanvas
            width={width}
            height={height}
            box={box}
            t={t}
            clock={clock}
            meteorsSince={TL.end - introStart(mode) + 1500}
            exit={exit}
            tap={tap}
            still={still}
          />
        </Pressable>
      ) : null}

      {ready ? (
        <WelcomeIllustration
          scale={scale}
          screenWidth={width}
          bottom={bottom}
          t={t}
          clock={clock}
          exit={exit}
          still={still}
        />
      ) : null}

      <Animated.View
        testID="welcome-content"
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        style={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          contentStyle,
        ]}
      >
        <Logo t={t} label={vm.appName} />
        <Appear index={1} t={t}>
          <AppText variant="title" style={styles.tagline}>
            {vm.tagline}
          </AppText>
        </Appear>
        <Appear index={2} t={t}>
          <AppText color="boira" style={styles.description}>
            {vm.description}
          </AppText>
        </Appear>
        <View style={styles.buttons}>
          <Appear index={3} t={t}>
            <Button
              variant="light"
              label={vm.googleLabel}
              onPress={() => leave(vm.continueWithGoogle)}
              haptic
            />
          </Appear>
          {vm.showApple ? (
            <Appear index={4} t={t}>
              <Button
                variant="secondary"
                label={vm.appleLabel}
                onPress={() => leave(vm.continueWithApple)}
                haptic
              />
            </Appear>
          ) : null}
          <Appear index={5} t={t}>
            <Button
              variant="secondary"
              label={vm.emailLabel}
              onPress={() => leave(vm.continueWithEmail)}
              haptic
              icon={
                <View style={styles.icon}>
                  <Image source={mailIcon} style={styles.mailIcon} />
                </View>
              }
            />
          </Appear>
        </View>
        <Appear index={6} t={t}>
          <AppText variant="caption" color="boira" style={styles.legal}>
            {vm.legal}
          </AppText>
        </Appear>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  content: { paddingHorizontal: spacing.lg },
  // Mides dels SVG del Figma.
  logo: { width: LOGO.width, height: LOGO.height },
  logoMask: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  spark: {
    position: 'absolute',
    left: LOGO.star.x - LOGO.star.size / 2,
    top: LOGO.star.y - LOGO.star.size / 2,
    width: LOGO.star.size,
    height: LOGO.star.size,
  },
  fill: { width: '100%', height: '100%' },
  mailIcon: { width: 19.25, height: 15.58 },
  tagline: { marginTop: spacing.ms },
  description: { marginTop: spacing.xs },
  buttons: { marginTop: spacing.lg, gap: spacing.ms },
  icon: { width: sizes.icon, height: sizes.icon, alignItems: 'center', justifyContent: 'center' },
  legal: { marginTop: spacing.ms, textAlign: 'center' },
});

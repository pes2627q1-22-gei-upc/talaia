import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients, motion, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';

import { useWelcomeViewModel } from './useWelcomeViewModel';
import {
  ILLUSTRATION,
  illustrationScale,
  TIMELINE,
  WelcomeIllustration,
} from './WelcomeIllustration';

const logotip = require('@/assets/images/welcome/logotip.svg');
const mailIcon = require('@/assets/images/welcome/mail.svg');

/** El contingut entra quan la torre ja s'ha alçat: en cascada i amb un spring suau. */
const CONTENT_START = TIMELINE.window + motion.stagger * 2;

function Appear({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(CONTENT_START + index * motion.stagger * 1.5)
        .springify()
        .damping(motion.spring.damping)
        .stiffness(motion.spring.stiffness)
        .withInitialValues({ opacity: 0, transform: [{ translateY: spacing.ms }] })}
    >
      {children}
    </Animated.View>
  );
}

/** Benvinguda i accés (HU35, mockup 01). La sessió arriba amb TG-81 i TG-83. */
export function WelcomeScreen() {
  const vm = useWelcomeViewModel();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);

  const scale = illustrationScale({ width, height, topInset: insets.top }, contentHeight);

  // En triar una opció: el contingut baixa i s'esvaeix, el cel s'apropa i després es navega.
  const reduceMotion = useReducedMotion();
  const exit = useSharedValue(0);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(leaving.current ?? undefined), []);
  const leave = (action: () => void) => {
    if (leaving.current) return;
    const duration = reduceMotion ? motion.fast : motion.leave;
    exit.set(withTiming(1, { duration, easing: motion.exit }));
    leaving.current = setTimeout(action, duration);
  };
  const contentStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ translateY: reduceMotion ? 0 : exit.get() * spacing.lg }],
  }));

  return (
    <LinearGradient
      colors={gradients.cel.colors}
      locations={gradients.cel.locations}
      style={styles.root}
    >
      {contentHeight > 0 ? (
        <WelcomeIllustration
          scale={scale}
          screenWidth={width}
          bottom={contentHeight - ILLUSTRATION.contentOverlap * scale}
          exit={exit}
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
        <Appear index={0}>
          <Image
            source={logotip}
            accessible
            accessibilityRole="header"
            accessibilityLabel={vm.appName}
            style={styles.logotip}
          />
        </Appear>
        <Appear index={1}>
          <AppText variant="title" style={styles.tagline}>
            {vm.tagline}
          </AppText>
        </Appear>
        <Appear index={2}>
          <AppText color="boira" style={styles.description}>
            {vm.description}
          </AppText>
        </Appear>
        <View style={styles.buttons}>
          <Appear index={3}>
            <Button
              variant="light"
              label={vm.googleLabel}
              onPress={() => leave(vm.continueWithGoogle)}
              haptic
            />
          </Appear>
          {vm.showApple ? (
            <Appear index={4}>
              <Button
                variant="secondary"
                label={vm.appleLabel}
                onPress={() => leave(vm.continueWithApple)}
                haptic
              />
            </Appear>
          ) : null}
          <Appear index={5}>
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
        <Appear index={6}>
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
  logotip: { width: 190, height: 77 },
  mailIcon: { width: 19.25, height: 15.58 },
  tagline: { marginTop: spacing.ms },
  description: { marginTop: spacing.xs },
  buttons: { marginTop: spacing.lg, gap: spacing.ms },
  icon: { width: sizes.icon, height: sizes.icon, alignItems: 'center', justifyContent: 'center' },
  legal: { marginTop: spacing.ms, textAlign: 'center' },
});

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients, motion, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';

import { useWelcomeViewModel } from './useWelcomeViewModel';
import { ILLUSTRATION, illustrationScale, WelcomeIllustration } from './WelcomeIllustration';

const logotip = require('@/assets/images/welcome/logotip.svg');
const mailIcon = require('@/assets/images/welcome/mail.svg');

/** Entra en cascada: fosa i 8 pt de pujada, `motion.stagger` després de l'anterior. */
function Appear({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(index * motion.stagger)
        .easing(motion.enter)
        .withInitialValues({ opacity: 0, transform: [{ translateY: spacing.sm }] })}
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
        />
      ) : null}

      <View
        testID="welcome-content"
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
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
            <Button variant="light" label={vm.googleLabel} onPress={vm.continueWithGoogle} haptic />
          </Appear>
          {vm.showApple ? (
            <Appear index={4}>
              <Button
                variant="secondary"
                label={vm.appleLabel}
                onPress={vm.continueWithApple}
                haptic
              />
            </Appear>
          ) : null}
          <Appear index={5}>
            <Button
              variant="secondary"
              label={vm.emailLabel}
              onPress={vm.continueWithEmail}
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
      </View>
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

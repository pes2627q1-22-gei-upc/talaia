import type { PropsWithChildren } from 'react';

import Animated, { FadeInDown } from 'react-native-reanimated';
import { type Edges, SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles } from '@/core/theme/theme';
import { motion, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { BackButton } from './BackButton';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Vores on s'aplica l'àrea segura. */
  edges?: Edges;
  /**
   * Una pantalla de la pila (`/plans`): el botó enrere, fix sobre el títol. El de la capçalera nativa
   * és de vidre des d'iOS 26 i en mode nit no es pot posar en vermell (ADR-0032).
   */
  back?: { label: string; onPress: () => void };
}>;

/** Entrada del primer cop que es munta una pantalla: fosa i 6 pt, sense fer esperar. */
const enter = (delay: number) =>
  FadeInDown.duration(motion.base)
    .delay(delay)
    .easing(motion.enter)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] });

/** Esquelet comú d'una pantalla: fons de nit, títol de la marca i subtítol. */
export function Screen({ title, subtitle, edges, back, children }: ScreenProps) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <Animated.View entering={enter(0)} style={styles.header}>
        {back ? <BackButton label={back.label} onPress={back.onPress} /> : null}
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="boira">
            {subtitle}
          </AppText>
        ) : null}
      </Animated.View>
      <Animated.View entering={enter(motion.stagger)} style={styles.body}>
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.nit,
  },
  header: {
    paddingHorizontal: spacing.ml,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  body: {
    flex: 1,
    padding: spacing.ml,
    gap: spacing.md,
  },
}));

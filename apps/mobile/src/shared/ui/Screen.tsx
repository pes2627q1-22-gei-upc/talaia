import type { PropsWithChildren } from 'react';

import Animated, { FadeInDown } from 'react-native-reanimated';
import { type Edges, SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles } from '@/core/theme/theme';
import { motion, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /**
   * Vores on s'aplica l'àrea segura. Una pantalla de la pila amb capçalera (`/plans`) no la
   * necessita a dalt: ja la posa la capçalera.
   */
  edges?: Edges;
}>;

/** Entrada del primer cop que es munta una pantalla: fosa i 6 pt, sense fer esperar. */
const enter = (delay: number) =>
  FadeInDown.duration(motion.base)
    .delay(delay)
    .easing(motion.enter)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] });

/** Esquelet comú d'una pantalla: fons de nit, títol de la marca i subtítol. */
export function Screen({ title, subtitle, edges, children }: ScreenProps) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <Animated.View entering={enter(0)} style={styles.header}>
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

import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

/** Esquelet comú d'una pantalla: fons de nit, títol de la marca i subtítol. */
export function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="boira">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});

import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

type StateMessageProps = {
  title: string;
  message?: string;
  /** P. ex. «Torna-ho a provar» en un error. Els textos arriben traduïts del ViewModel. */
  action?: { label: string; onPress: () => void };
  /** Il·lustra l'estat (una pestanya «Aviat»). */
  icon?: ImageSource;
  /** Ocupa l'espai que queda i s'hi centra: per a una pantalla sencera, no per a una secció. */
  fill?: boolean;
};

/** Estat buit o d'error d'una pantalla o d'una secció. */
export function StateMessage({ title, message, action, icon, fill }: StateMessageProps) {
  return (
    <View style={[styles.container, fill && styles.fill]} accessibilityLiveRegion="polite">
      {icon ? (
        <Image source={icon} tintColor={colors.pedra} style={styles.icon} accessible={false} />
      ) : null}
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="small" color="boira" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <Button
          variant="secondary"
          label={action.label}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  // Una mica per sobre del centre: centrat del tot, sembla que caigui.
  fill: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xl * 2 },
  icon: { width: sizes.icon * 2, height: sizes.icon * 2, marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  action: { marginTop: spacing.sm },
});

import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

type StateMessageProps = {
  title: string;
  message?: string;
  /** P. ex. «Torna-ho a provar» en un error. Els textos arriben traduïts del ViewModel. */
  action?: { label: string; onPress: () => void };
};

/** Estat buit o d'error d'una pantalla o d'una secció. */
export function StateMessage({ title, message, action }: StateMessageProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
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
  center: { textAlign: 'center' },
  action: { marginTop: spacing.sm },
});

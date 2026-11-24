import { View } from 'react-native';

import { makeStyles } from '@/core/theme/theme';
import { sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmació d'una acció destructiva: «Tanca la sessió» (perfil) o «Elimina» (plans, TG-162). */
export function ConfirmationSheet({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: Props) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} title={title} closeLabel={cancelLabel} onClose={onCancel}>
      <AppText variant="body" color="boira">
        {message}
      </AppText>
      <View style={styles.actions}>
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
        <PressableScale
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onConfirm}
          style={[styles.confirm, disabled && styles.disabled]}
        >
          <AppText variant="label" color="perill">
            {confirmLabel}
          </AppText>
        </PressableScale>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(() => ({
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  confirm: { flex: 1, minHeight: sizes.button, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
}));

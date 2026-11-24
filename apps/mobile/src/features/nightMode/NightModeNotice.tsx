import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

/** Prou per llegir-lo; després desapareix sol. */
export const NOTICE_DURATION_MS = 8000;

type Props = {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
};

/** L'avís de dalt quan el mode nit s'activa sol (HU45), amb «Desactiva». */
export function NightModeNotice({ message, actionLabel, onAction, onDismiss }: Props) {
  const styles = useStyles();
  const { top } = useSafeAreaInsets();
  useEffect(() => {
    const timer = setTimeout(onDismiss, NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <Animated.View
      entering={FadeInUp.duration(motion.base)}
      exiting={FadeOutUp.duration(motion.base)}
      style={[styles.wrap, { top: top + spacing.sm }]}
      pointerEvents="box-none"
    >
      <View style={styles.notice} accessibilityLiveRegion="polite" testID="night-mode-notice">
        <AppText variant="small" style={styles.message}>
          {message}
        </AppText>
        <PressableScale onPress={onAction} accessibilityLabel={actionLabel} style={styles.action}>
          <AppText variant="label" color="far">
            {actionLabel}
          </AppText>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  message: { flex: 1, paddingVertical: spacing.ms },
  action: {
    minHeight: sizes.touch,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

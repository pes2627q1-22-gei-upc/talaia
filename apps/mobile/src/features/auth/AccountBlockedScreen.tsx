import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, motion, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';

import { useAccountBlockedViewModel } from './useAccountBlockedViewModel';

/** El compte està bloquejat (403 `account_blocked`): no es pot entrar a l'app fins que el desbloquegin. */
export function AccountBlockedScreen() {
  const vm = useAccountBlockedViewModel();
  return (
    <SafeAreaView style={styles.root}>
      <Animated.View
        entering={FadeIn.duration(motion.base)}
        style={styles.content}
        testID="account-blocked-text"
        accessibilityLiveRegion="polite"
      >
        <AppText variant="title" accessibilityRole="header" style={styles.center}>
          {vm.title}
        </AppText>
        <AppText variant="body" color="boira" style={styles.center}>
          {vm.message}
        </AppText>
      </Animated.View>
      <View style={styles.actions}>
        <Button
          label={vm.signOutLabel}
          onPress={vm.signOut}
          disabled={vm.signingOut || vm.checking}
        />
        <Button
          variant="text"
          label={vm.retryLabel}
          onPress={vm.retry}
          disabled={vm.signingOut || vm.checking}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.nit, paddingHorizontal: spacing.lg },
  // El text al centre i els botons a baix, a l'abast del polze: no es tapen mai.
  content: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
});

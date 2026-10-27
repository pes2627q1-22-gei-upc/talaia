import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { motion, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';
import { TextField } from '@/shared/ui/TextField';

import { useEmailLoginViewModel } from './useEmailLoginViewModel';

/** Cada pas entra amb una fosa i 6 pt, com les pantalles (`Screen`). */
const stepEnter = FadeInDown.duration(motion.base)
  .easing(motion.enter)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] });

/** Inici de sessió amb el correu: adreça → codi de 6 xifres (HU35, TG-249). */
export function EmailLoginScreen() {
  const vm = useEmailLoginViewModel();
  const isCode = vm.step === 'code';
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen title={vm.title} subtitle={vm.subtitle}>
        <Animated.View key={vm.step} entering={stepEnter} style={styles.form}>
          {isCode ? (
            <TextField
              testID="email-login-code"
              label={vm.codeLabel}
              value={vm.code}
              onChangeText={vm.setCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={vm.codeLength}
              editable={!vm.pending}
              autoFocus
              error={vm.errorMessage}
            />
          ) : (
            <TextField
              testID="email-login-email"
              label={vm.emailLabel}
              placeholder={vm.emailPlaceholder}
              value={vm.email}
              onChangeText={vm.setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (vm.canSubmit) void vm.submit();
              }}
              editable={!vm.pending}
              autoFocus
              error={vm.errorMessage}
            />
          )}
          <Button
            label={vm.submitLabel}
            onPress={() => void vm.submit()}
            disabled={!vm.canSubmit}
            haptic
          />
          {isCode ? (
            <View style={styles.links}>
              <Button
                variant="text"
                label={vm.resendLabel}
                onPress={() => void vm.resend()}
                disabled={!vm.canResend}
              />
              <Button variant="text" label={vm.changeEmailLabel} onPress={vm.changeEmail} />
            </View>
          ) : null}
          {vm.notice ? (
            <Animated.View entering={FadeIn.duration(motion.base)}>
              <AppText variant="small" color="ras" accessibilityRole="alert">
                {vm.notice}
              </AppText>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  form: { gap: spacing.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});

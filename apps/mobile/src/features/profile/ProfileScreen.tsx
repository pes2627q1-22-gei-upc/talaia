import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';
import { ApiStatusCard } from '@/features/apiStatus/ApiStatusCard';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Screen } from '@/shared/ui/Screen';

import { useProfileViewModel } from './useProfileViewModel';

export function ProfileScreen() {
  const vm = useProfileViewModel();
  return (
    <Screen title={vm.title}>
      <AppText variant="small" color="boira">
        {vm.languageLabel}
      </AppText>
      <View style={styles.row}>
        {vm.languages.map((language) => (
          <Chip
            key={language.code}
            label={language.label}
            selected={language.selected}
            onPress={() => void vm.selectLanguage(language.code)}
          />
        ))}
      </View>
      <ApiStatusCard />
      {vm.auth.isAuthenticated ? (
        <Button
          label={vm.auth.logoutLabel}
          variant="secondary"
          disabled={vm.auth.signingOut || vm.auth.loading}
          onPress={() => void vm.auth.signOut()}
        />
      ) : null}
      {vm.auth.errorMessage ? (
        <View style={{ gap: spacing.sm }}>
          <AppText accessibilityRole="alert">{vm.auth.errorMessage}</AppText>
          {vm.auth.error === 'restore' ? (
            <Button label={vm.auth.retryLabel} onPress={() => void vm.auth.restore()} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});

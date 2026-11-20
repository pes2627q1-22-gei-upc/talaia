import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';
import { ApiStatusCard } from '@/features/apiStatus/ApiStatusCard';
import { FieldRow } from '@/features/explore/FieldRow';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Screen } from '@/shared/ui/Screen';

import { useProfileViewModel } from './useProfileViewModel';

const calendarIcon = require('@/assets/images/plans/calendari.svg');

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
      {vm.plans ? (
        <FieldRow
          icon={calendarIcon}
          label={vm.plans.label}
          accessibilityLabel={vm.plans.label}
          onPress={vm.plans.onPress}
          chevron
        />
      ) : null}
      {vm.auth.isAuthenticated ? (
        <View style={styles.account}>
          <AppText variant="small" color="boira">
            {vm.accountLabel}
          </AppText>
          {vm.email ? <AppText variant="body">{vm.email}</AppText> : null}
          <Button
            label={vm.auth.logoutLabel}
            variant="secondary"
            disabled={vm.auth.signingOut || vm.auth.loading}
            onPress={() => void vm.auth.signOut()}
          />
        </View>
      ) : null}
      {vm.showApiStatus ? <ApiStatusCard /> : null}
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
  account: { gap: spacing.sm, marginTop: spacing.sm },
});

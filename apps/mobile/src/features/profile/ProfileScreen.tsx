import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';
import { ApiStatusCard } from '@/features/apiStatus/ApiStatusCard';
import { AppText } from '@/shared/ui/AppText';
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});

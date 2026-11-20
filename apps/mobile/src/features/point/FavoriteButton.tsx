import { Image } from 'expo-image';
import { View } from 'react-native';

import { makeStyles, useNightTint, useTheme } from '@/core/theme/theme';
import { sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

import { useFavoriteViewModel } from './useFavoriteViewModel';

const outline = require('@/assets/images/point/heart-outline.svg');
const filled = require('@/assets/images/point/heart-filled.svg');

export function FavoriteButton({ pointId }: { pointId: string }) {
  const vm = useFavoriteViewModel(pointId);
  const styles = useStyles();
  const { colors } = useTheme();
  const nightTint = useNightTint();
  return (
    <View style={styles.container}>
      <PressableScale
        testID="favorite-button"
        accessibilityLabel={vm.label}
        accessibilityHint={vm.hint}
        accessibilityState={{ selected: vm.saved, disabled: vm.disabled }}
        disabled={vm.disabled}
        onPress={vm.press}
        haptic="selection"
        style={styles.button}
      >
        <Image
          source={vm.saved ? filled : outline}
          tintColor={vm.saved ? colors.ras : nightTint}
          style={styles.icon}
          accessible={false}
        />
      </PressableScale>
      {vm.error ? (
        <AppText variant="small" color="tap" accessibilityRole="alert" style={styles.error}>
          {vm.error}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { alignItems: 'flex-end', gap: spacing.xs },
  button: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: sizes.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.vel,
  },
  icon: { width: sizes.icon, height: sizes.icon },
  error: { backgroundColor: colors.nit, paddingHorizontal: spacing.sm },
}));

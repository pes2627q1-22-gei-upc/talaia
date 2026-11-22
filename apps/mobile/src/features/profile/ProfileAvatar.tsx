import { Image } from 'expo-image';
import { View } from 'react-native';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';

type Props = {
  avatarUrl: string | null;
  initials: string;
  large?: boolean;
};

/** La foto s'amaga en mode nit perquè els seus colors no es poden tenyir de vermell. */
export function ProfileAvatar({ avatarUrl, initials, large = false }: Props) {
  const styles = useStyles();
  const { name } = useTheme();
  const dimension = large ? sizes.button + spacing.lg : sizes.button;

  return (
    <View
      style={[styles.avatar, { width: dimension, height: dimension }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="profile-avatar"
    >
      {avatarUrl && name !== 'vermell' ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: dimension, height: dimension }}
          accessible={false}
          testID="profile-avatar-image"
        />
      ) : (
        <AppText variant="title" color="nit" accessible={false}>
          {initials}
        </AppText>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  avatar: {
    borderRadius: radii.pill,
    backgroundColor: colors.pedra,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));

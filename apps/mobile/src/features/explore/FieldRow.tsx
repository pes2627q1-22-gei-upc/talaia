import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Skeleton } from '@/shared/ui/Skeleton';

type FieldRowProps = {
  /** `require()` d'un SVG de `assets/images/explora`. */
  icon: number;
  label: string;
  hint: string;
  onPress?: () => void;
  /** Mentre es carrega el valor, un esquelet en lloc del text. */
  loading?: boolean;
};

/** Fila d'un camp del formulari: icona, valor i, a la dreta, què és o què fer-hi. */
export function FieldRow({ icon, label, hint, onPress, loading = false }: FieldRowProps) {
  const content = (
    <>
      <Image source={icon} style={styles.icon} accessible={false} />
      {loading ? (
        <View style={styles.value}>
          <Skeleton width="45%" height={14} />
        </View>
      ) : (
        <AppText variant="body" numberOfLines={1} style={styles.value}>
          {label}
        </AppText>
      )}
      {hint ? (
        <AppText variant="small" color="boira">
          {hint}
        </AppText>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={hint ? `${label}, ${hint}` : label}
        accessibilityState={{ busy: loading }}
        style={styles.row}
      >
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    height: sizes.field,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  icon: { width: sizes.icon, height: sizes.icon },
  value: { flex: 1 },
});

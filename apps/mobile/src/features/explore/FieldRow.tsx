import { Image, type ImageSource } from 'expo-image';
import { View } from 'react-native';

import { makeStyles, useNightTint } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Skeleton } from '@/shared/ui/Skeleton';

const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');

type FieldRowProps = {
  /** `require()` d'un SVG (`assets/images/explora`, fenòmens…). */
  icon: number | ImageSource;
  label: string;
  /** A la dreta: què és el camp o què s'hi fa. Buit, res. */
  hint?: string;
  onPress?: () => void;
  /** Mentre es carrega el valor, un esquelet en lloc del text. */
  loading?: boolean;
  /** Per defecte, «valor, pista». */
  accessibilityLabel?: string;
  /** Color de la icona, si el SVG no en porta. */
  iconTint?: string;
  /** Un `>` a la dreta quan s'hi pot tocar (Pla d'observació). */
  chevron?: boolean;
  /** `testID` de l'esquelet. */
  loadingTestID?: string;
};

/** Fila d'un camp del formulari: icona, valor i, a la dreta, què és o què fer-hi. */
export function FieldRow({
  icon,
  label,
  hint = '',
  onPress,
  loading = false,
  accessibilityLabel = hint ? `${label}, ${hint}` : label,
  iconTint,
  chevron = false,
  loadingTestID,
}: FieldRowProps) {
  const styles = useStyles();
  // Els SVG porten el seu color (la fletxa d'ubicació és blava): en mode nit es tenyeixen tots.
  const tint = useNightTint();
  const content = (
    <>
      <Image source={icon} tintColor={iconTint ?? tint} style={styles.icon} accessible={false} />
      {loading ? (
        <View style={styles.value} testID={loadingTestID}>
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
      {chevron && onPress ? (
        <Image source={chevronIcon} tintColor={tint} style={styles.chevron} accessible={false} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: loading }}
        style={styles.row}
      >
        {content}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} style={styles.row}>
      {content}
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  chevron: {
    width: sizes.iconSmall,
    height: sizes.iconSmall,
    transform: [{ rotate: '-90deg' }],
  },
}));

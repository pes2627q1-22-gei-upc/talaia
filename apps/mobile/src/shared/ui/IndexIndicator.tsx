import type { IndexVisibilitat } from '@talaia/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';

type IndexIndicatorProps = {
  index: IndexVisibilitat;
  /** `md`: xifra amb la franja a sota (llistes). `lg`: només la xifra (detall del punt). */
  size?: 'md' | 'lg';
};

/**
 * Xifra de l'índex amb el color de la seva franja. La franja arriba de l'API i és el nom del token
 * de color: l'app no calcula cap llindar (P12, TG-98).
 */
export function IndexIndicator({ index, size = 'md' }: IndexIndicatorProps) {
  const { t } = useTranslation();
  const value = Math.round(Math.min(100, Math.max(0, index.valor)));
  const level = t(`index.level.${index.franja}`);

  return (
    <View
      accessible
      accessibilityLabel={t('index.a11y', { value, level })}
      style={size === 'md' && styles.md}
    >
      <AppText variant={size === 'lg' ? 'indexLg' : 'indexMd'} color={index.franja}>
        {value}
      </AppText>
      {size === 'md' ? (
        <AppText variant="overline" color={index.franja}>
          {level}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  md: { alignItems: 'center', gap: spacing.xs / 2 },
});

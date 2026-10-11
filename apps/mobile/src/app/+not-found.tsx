import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { colors, typography } from '@/core/theme/tokens';
import { Screen } from '@/shared/ui/Screen';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen title={t('notFound.title')}>
      <Link href="/" style={styles.link}>
        {t('notFound.back')}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { ...typography.label, color: colors.far },
});

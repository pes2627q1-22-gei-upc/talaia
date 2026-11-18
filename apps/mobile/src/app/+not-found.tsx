import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/core/theme/theme';
import { typography } from '@/core/theme/tokens';
import { Screen } from '@/shared/ui/Screen';

export default function NotFound() {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <Screen title={t('notFound.title')}>
      <Link href="/" style={styles.link}>
        {t('notFound.back')}
      </Link>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  link: { ...typography.label, color: colors.far },
}));

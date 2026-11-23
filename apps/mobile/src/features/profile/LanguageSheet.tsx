import { View } from 'react-native';

import { makeStyles } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';

import type { useProfileViewModel } from './useProfileViewModel';

type Props = Pick<
  ReturnType<typeof useProfileViewModel>,
  | 'languageOpen'
  | 'languageLabel'
  | 'languageCloseLabel'
  | 'closeLanguage'
  | 'languages'
  | 'selectLanguage'
>;

/** El selector d'idioma segueix el mateix full inferior que els altres selectors de l'app. */
export function LanguageSheet({
  languageOpen,
  languageLabel,
  languageCloseLabel,
  closeLanguage,
  languages,
  selectLanguage,
}: Props) {
  const styles = useStyles();
  return (
    <Sheet
      visible={languageOpen}
      title={languageLabel}
      closeLabel={languageCloseLabel}
      onClose={closeLanguage}
      swipeToClose
    >
      <View style={styles.options}>
        {languages.map((language) => (
          <PressableScale
            key={language.code}
            accessibilityRole="radio"
            accessibilityLabel={language.label}
            accessibilityState={{ selected: language.selected }}
            haptic="selection"
            onPress={() => void selectLanguage(language.code)}
            style={[styles.option, language.selected && styles.selected]}
          >
            <AppText variant="body">{language.label}</AppText>
            {language.selected ? <View style={styles.selectedDot} /> : null}
          </PressableScale>
        ))}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  options: { gap: spacing.sm },
  option: {
    minHeight: sizes.button,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selected: { borderColor: colors.far },
  selectedDot: {
    width: sizes.legendDot,
    height: sizes.legendDot,
    borderRadius: radii.pill,
    backgroundColor: colors.far,
  },
}));

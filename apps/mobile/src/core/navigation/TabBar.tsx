import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useContext } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { radii, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

/**
 * Amb la lletra més gran del sistema, les etiquetes es tallaven («Expl…»). La barra nativa d'iOS
 * tampoc no les fa créixer: creixen com a molt 1,2 vegades, i el lector de pantalla les llegeix.
 */
const LABEL_MAX_SCALE = 1.2;

/** SF Symbols a iOS i Material Symbols a Android (expo-symbols, que Expo Go porta). */
const ICONS: Record<string, SymbolViewProps['name']> = {
  '(explora)': { ios: 'safari', android: 'explore' },
  calendari: { ios: 'calendar', android: 'calendar_month' },
  '(alertes)': { ios: 'bell', android: 'notifications' },
  perfil: { ios: 'person.crop.circle', android: 'account_circle' },
};

/**
 * Barra de pestanyes pròpia (ADR-0037). Des d'iOS 26 la nativa té un vidre que pinta el sistema i
 * deixa les pestanyes no triades en blanc: en mode nit no pot ser tota vermella. Aquesta va amb el
 * tema. Queda sota les pantalles, i no per sobre: cap contingut no hi queda tapat.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const styles = useStyles();
  const { name, colors } = useTheme();
  // En mode nit, `far` i `boira` són gairebé el mateix vermell: la triada s'inverteix, com un xip.
  const selectedColor = name === 'vermell' ? ('nit' as const) : ('far' as const);
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const scale = Math.min(useWindowDimensions().fontScale, LABEL_MAX_SCALE);
  const labelSize = {
    fontSize: typography.caption.fontSize * scale,
    lineHeight: typography.caption.lineHeight * scale,
  };
  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.capsule} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const color = selected ? selectedColor : ('boira' as const);
          const icon = ICONS[route.name];
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!selected && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={onPress}
              style={[styles.item, selected && styles.itemSelected]}
            >
              {icon && (
                <SymbolView
                  name={icon}
                  tintColor={colors[color]}
                  size={sizes.icon + spacing.xxs}
                  style={styles.icon}
                />
              )}
              <AppText
                variant="caption"
                color={color}
                numberOfLines={1}
                allowFontScaling={false}
                style={labelSize}
              >
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ name, colors }) => ({
  bar: {
    backgroundColor: colors.nit,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  capsule: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    minHeight: sizes.touch + spacing.sm,
    borderRadius: radii.pill,
  },
  itemSelected: { backgroundColor: name === 'vermell' ? colors.far : colors.crep },
  icon: { width: sizes.icon + spacing.xxs, height: sizes.icon + spacing.xxs },
}));

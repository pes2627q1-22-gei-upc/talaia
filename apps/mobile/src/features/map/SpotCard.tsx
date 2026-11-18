import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { IndexIndicator } from '@/shared/ui/IndexIndicator';
import { PressableScale } from '@/shared/ui/PressableScale';

import type { SpotState } from './useMapSpot';

export type SpotCardModel = {
  title: string;
  coords: string;
  travel: string | null;
  closeLabel: string;
  onClose: () => void;
  state: SpotState;
};

// El color el posa `tintColor`, perquè canvia amb el tema (mode nit).
const pinIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="#000" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/>
      <path d="M12 6.6l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z"/>
    </svg>
  `)}`,
};

const closeIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round">
      <path d="M7 7L17 17M17 7L7 17"/>
    </svg>
  `)}`,
};

/**
 * «Punt triat al mapa» (mockup 04): on s'ha tocat, a quant és d'on ets i, en prémer el botó,
 * l'índex d'aquell lloc a l'hora en curs.
 */
export function SpotCard({ card }: { card: SpotCardModel }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { state } = card;
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <View style={styles.text}>
          <AppText variant="heading" accessibilityRole="header">
            {card.title}
          </AppText>
          <AppText variant="small" color="boira">
            {card.coords}
          </AppText>
          {card.travel && (
            <AppText variant="small" color="boira">
              {card.travel}
            </AppText>
          )}
        </View>
        <Image source={pinIcon} tintColor={colors.far} style={styles.pin} accessible={false} />
        <PressableScale
          onPress={card.onClose}
          accessibilityLabel={card.closeLabel}
          hitSlop={spacing.ms}
          style={styles.close}
        >
          <Image
            source={closeIcon}
            tintColor={colors.boira}
            style={styles.closeIcon}
            accessible={false}
          />
        </PressableScale>
      </View>

      {state.kind === 'idle' && (
        <Button label={state.action.label} onPress={state.action.onPress} haptic />
      )}

      {state.kind === 'loading' && (
        <View style={styles.row} accessible accessibilityState={{ busy: true }}>
          <ActivityIndicator size="small" color={colors.far} testID="spot-loading" />
          <AppText variant="label" color="boira">
            {state.label}
          </AppText>
        </View>
      )}

      {state.kind === 'result' && (
        <View style={styles.result}>
          {state.index && <IndexIndicator index={state.index} />}
          <View style={styles.text}>
            <AppText variant="label">{state.at}</AppText>
            {state.notes.map((note) => (
              <AppText key={note} variant="small" color="boira">
                {note}
              </AppText>
            ))}
          </View>
        </View>
      )}

      {state.kind === 'problem' && (
        <View style={styles.text}>
          <AppText variant="label">{state.title}</AppText>
          <AppText variant="small" color="boira">
            {state.description}
          </AppText>
          {state.action && (
            <PressableScale
              onPress={state.action.onPress}
              hitSlop={spacing.ms}
              style={styles.retry}
            >
              <AppText variant="link" color="far">
                {state.action.label}
              </AppText>
            </PressableScale>
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
    shadowColor: colors.nit,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, gap: spacing.xs },
  pin: { width: sizes.icon, height: sizes.icon },
  close: {
    width: sizes.iconSmall + spacing.sm,
    height: sizes.iconSmall + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: sizes.iconSmall, height: sizes.iconSmall },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, minHeight: sizes.button },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  retry: { alignSelf: 'flex-start', marginTop: spacing.xs },
}));

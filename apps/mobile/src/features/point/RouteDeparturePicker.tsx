import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { makeStyles } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { MonthCalendar } from '@/shared/ui/MonthCalendar';
import { PressableScale } from '@/shared/ui/PressableScale';
import { WheelPicker } from '@/shared/ui/WheelPicker';

const TIME_ZONE = 'Europe/Madrid';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
const twoDigits = (value: number) => String(value).padStart(2, '0');

function madridParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (part: string) => parts.find((item) => item.type === part)?.value ?? '00';
  return {
    day: `${value('year')}-${value('month')}-${value('day')}`,
    hour: value('hour'),
    minute: value('minute'),
  };
}

/** Retorna null per a hores inexistents durant el canvi d'hora. */
function madridInstant(day: string, hour: string, minute: string): string | null {
  const h = Number(hour);
  const m = Number(minute);
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) return null;
  const [year, month, date] = day.split('-').map(Number);
  const utc = Date.UTC(year!, month! - 1, date!, h, m);
  for (const offset of [1, 2]) {
    const candidate = new Date(utc - offset * 60 * 60_000);
    const parts = madridParts(candidate);
    if (parts.day === day && Number(parts.hour) === h && Number(parts.minute) === m) {
      return candidate.toISOString();
    }
  }
  return null;
}

type Props = {
  departure?: string;
  onChange: (departure?: string) => void;
};

export function RouteDepartureControl({
  departure,
  onPress,
}: {
  departure?: string;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const label = departure
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ca', {
        timeZone: TIME_ZONE,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(departure))
    : t('point.routeDepartureNow');
  return (
    <View style={styles.row}>
      <AppText variant="small" color="boira">
        {t('point.routeDepartureChoice')}
      </AppText>
      <PressableScale
        onPress={onPress}
        accessibilityLabel={t('point.routeDepartureEdit', { value: label })}
        style={styles.trigger}
      >
        <AppText variant="link" color="far">
          {label} ›
        </AppText>
      </PressableScale>
    </View>
  );
}

export function RouteDeparturePicker({ departure, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const [initial] = useState(() => madridParts(new Date(departure ?? Date.now() + 5 * 60_000)));
  const [day, setDay] = useState(initial.day);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [invalid, setInvalid] = useState(false);
  const locale = i18n.resolvedLanguage ?? 'ca';
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const today = madridParts(new Date(clock)).day;
  const earliest = madridParts(new Date(clock + 60_000));
  const selectedDay = day < earliest.day ? earliest.day : day;
  const firstHour = selectedDay === earliest.day ? Number(earliest.hour) : 0;
  const selectedHour = Math.max(Number(hour), firstHour);
  const firstMinute =
    selectedDay === earliest.day && selectedHour === Number(earliest.hour)
      ? Number(earliest.minute)
      : 0;
  const selectedMinute = Math.max(Number(minute), firstMinute);
  const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(
      new Date(`${date}T12:00:00Z`),
    );
  return (
    <View style={styles.editor}>
      <MonthCalendar
        key={selectedDay.slice(0, 7)}
        value={selectedDay}
        today={today}
        min={earliest.day}
        onChange={(value) => {
          setDay(value);
          setInvalid(false);
        }}
        firstDay={locale === 'en' ? 0 : 1}
        weekdayNames={Array.from({ length: 7 }, (_, index) =>
          new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
            new Date(Date.UTC(2026, 10, 22 + index)),
          ),
        )}
        formatTitle={({ year, month }) =>
          dateLabel(`${year}-${String(month + 1).padStart(2, '0')}-01`, {
            month: 'long',
            year: 'numeric',
          })
        }
        dayLabel={(value) => dateLabel(value, { day: 'numeric', month: 'long' })}
        previousLabel={t('point.routePreviousMonth')}
        nextLabel={t('point.routeNextMonth')}
      />
      <View style={styles.timeLabels}>
        <AppText variant="tag" color="boira" style={styles.timeLabel}>
          {t('point.routeHourLabel')}
        </AppText>
        <AppText variant="tag" color="boira" style={styles.timeLabel}>
          {t('point.routeMinuteLabel')}
        </AppText>
      </View>
      <View style={styles.timeRow}>
        <View pointerEvents="none" style={styles.band} />
        <WheelPicker
          key={`${selectedDay}-${firstHour}`}
          values={HOURS.slice(firstHour)}
          value={selectedHour}
          onChange={(value) => {
            setHour(twoDigits(value));
            setInvalid(false);
          }}
          format={twoDigits}
          accessibilityLabel={t('point.routeHourLabel')}
          band={false}
          compact
        />
        <AppText variant="heading" style={styles.separator}>
          :
        </AppText>
        <WheelPicker
          key={`${selectedDay}-${selectedHour}-${firstMinute}`}
          values={MINUTES.slice(firstMinute)}
          value={selectedMinute}
          onChange={(value) => {
            setMinute(twoDigits(value));
            setInvalid(false);
          }}
          format={twoDigits}
          accessibilityLabel={t('point.routeMinuteLabel')}
          band={false}
          compact
        />
      </View>
      {invalid ? (
        <AppText variant="small" color="jus">
          {t('point.routeInvalidDeparture')}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          label={t('point.routeDepartureNowAction')}
          style={styles.nowAction}
          onPress={() => {
            onChange(undefined);
          }}
        />
        <Button
          variant="primary"
          label={t('point.routeDepartureApply')}
          onPress={() => {
            const instant = madridInstant(
              selectedDay,
              twoDigits(selectedHour),
              twoDigits(selectedMinute),
            );
            if (!instant || Date.parse(instant) <= Date.now()) {
              setClock(Date.now());
              setInvalid(true);
              return;
            }
            onChange(instant);
            setInvalid(false);
          }}
          style={styles.applyAction}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  trigger: { minHeight: sizes.touch, justifyContent: 'center' },
  editor: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.sheet,
  },
  timeLabels: { flexDirection: 'row' },
  timeLabel: { flex: 1, textAlign: 'center', textTransform: 'uppercase' },
  timeRow: { flexDirection: 'row', alignItems: 'center', height: 120 },
  separator: { width: 24, textAlign: 'center' },
  band: {
    position: 'absolute',
    top: 40,
    right: 0,
    left: 0,
    height: 40,
    borderRadius: radii.field,
    backgroundColor: colors.crep,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nowAction: { flex: 1, minWidth: 0, paddingHorizontal: spacing.sm },
  applyAction: { flex: 2, minWidth: 0, paddingHorizontal: spacing.sm },
}));

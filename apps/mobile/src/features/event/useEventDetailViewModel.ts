import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';
import { eventAppearance, eventTypeLabelKey } from '@/features/calendar/phenomenonAppearance';

import { eventSchedule, type Night } from './eventModel';
import { useEventQuery } from './eventRepository';

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** En català, l'1 i l'11 apostrofen: «de l'1», «a l'11». */
const vowel = (day: string) => (['01', '11'].includes(day.slice(-2)) ? 'vowel' : undefined);
/** «a la 01:13», però «a les 13:10». */
const oneOClock = (time: string) => (time.startsWith('01:') ? 'oneOClock' : undefined);

/** Fitxa d'un esdeveniment del calendari (HU10, mockup 09). */
export function useEventDetailViewModel(eventId: string) {
  const { t, i18n } = useTranslation();
  const query = useEventQuery(eventId, i18n.resolvedLanguage ?? 'ca');
  const common = {
    headerTitle: t('event.title'),
    backLabel: t('event.back'),
    back: () => (router.canGoBack() ? router.back() : router.replace('/calendari')),
  };
  const event = query.data;
  if (!event) {
    if (query.isPending) return { ...common, status: 'loading' as const };
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return {
      ...common,
      status: notFound ? ('notFound' as const) : ('error' as const),
      errorTitle: t(notFound ? 'event.notFoundTitle' : 'event.errorTitle'),
      errorMessage: t(notFound ? 'event.notFoundMessage' : 'event.errorMessage'),
      retryLabel: t('event.retry'),
      retry: () => {
        void query.refetch();
      },
    };
  }

  const locale =
    i18n.resolvedLanguage === 'es' ? 'es-ES' : i18n.resolvedLanguage === 'en' ? 'en-GB' : 'ca-ES';
  // Les dates ja són dies civils de Catalunya: es formaten a migdia UTC perquè no es moguin.
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
      .format(new Date(`${day}T12:00:00Z`))
      .replace(/’/g, "'");
  const dayMonth = (day: string) => format(day, { day: 'numeric', month: 'long' });
  const fullDate = (day: string) =>
    capitalize(format(day, { weekday: 'long', day: 'numeric', month: 'long' }));
  const night = ({ from, to }: Night) =>
    t('event.night', {
      from: t('event.nightFrom', {
        date: from.slice(0, 7) === to.slice(0, 7) ? String(Number(from.slice(-2))) : dayMonth(from),
        context: vowel(from),
      }),
      to: t('event.nightTo', { date: dayMonth(to), context: vowel(to) }),
    });
  const at = (time: string) => t('event.atTime', { time, context: oneOClock(time) });

  // Sense el detall, la precisió provisional del model (`provisionalPrecision`).
  const schedule = eventSchedule(event, event.horari?.precisio);
  let dateLabel: string;
  let when: string;
  if (schedule.kind === 'season') {
    const range = {
      from: t('event.rangeFrom', { date: dayMonth(schedule.from), context: vowel(schedule.from) }),
      to: t('event.rangeTo', { date: dayMonth(schedule.to), context: vowel(schedule.to) }),
    };
    const { peak } = schedule;
    dateLabel = peak ? fullDate(peak.date) : capitalize(`${range.from} ${range.to}`);
    if (peak) {
      const day = t('event.onDay', { date: dayMonth(peak.date), context: vowel(peak.date) });
      when = t('event.whenSeason', { ...range, peak: peak.time ? `${day} ${at(peak.time)}` : day });
    } else {
      when = t('event.whenSeasonNoPeak', range);
    }
  } else if (schedule.kind === 'day') {
    dateLabel = fullDate(schedule.date);
    when = schedule.exact
      ? t('event.whenExact', { time: schedule.exact, at: at(schedule.exact) })
      : t('event.whenAllDay');
  } else {
    dateLabel = schedule.night ? capitalize(night(schedule.night)) : fullDate(schedule.date);
    const window = {
      from: t('event.fromTime', { time: schedule.start, context: oneOClock(schedule.start) }),
      to: t('event.toTime', { time: schedule.end, context: oneOClock(schedule.end) }),
    };
    when = capitalize(
      schedule.peak
        ? t('event.whenWindow', { ...window, peak: at(schedule.peak) })
        : t('event.whenWindowNoPeak', window),
    );
  }

  return {
    ...common,
    status: 'ok' as const,
    name: event.nom,
    typeLabel: capitalize(t(`calendar.types.${eventTypeLabelKey(event.tipus)}`)),
    dateLabel,
    whenTitle: t('event.when'),
    when,
    descriptionTitle: t('event.whatYouWillSee'),
    // Al calendari, `descripcio` ja hi porta la particularitat; al detall van separades.
    description: event.explicacio?.fenomen ?? event.descripcio,
    particularityTitle: t('event.particularity'),
    particularity: event.explicacio?.particularitat ?? null,
    howToWatchTitle: t('event.howToWatch'),
    howToWatch: event.explicacio
      ? `${event.explicacio.observacioEsdeveniment} ${event.explicacio.observacioGeneral}`
      : null,
    source: t('event.source', { source: event.font }),
    icon: eventAppearance(event).icon,
    meteors: event.tipus === 'pluja_estels',
    /** Cada esdeveniment té el seu cel, sempre el mateix. */
    skySeed: event.id,
  };
}

import type { EsdevenimentsResponse } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiGet } from '@/core/api/httpClient';
import type { CalendarMonth } from '@/shared/ui/calendarGrid';

import { calendarWindowBounds } from './calendarModel';

export function fetchCalendarEvents(month: CalendarMonth) {
  const { from, to } = calendarWindowBounds(month);
  return apiGet<EsdevenimentsResponse>('/esdeveniments', { des_de: from, fins_a: to });
}

export function useCalendarEventsQuery(month: CalendarMonth) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ['calendar', i18n.resolvedLanguage ?? 'ca', month.year, month.month],
    queryFn: () => fetchCalendarEvents(month),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

import type { EsdevenimentsResponse } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';
import type { CalendarMonth } from '@/shared/ui/calendarGrid';

import { calendarWindowBounds } from './calendarModel';

export function fetchCalendarEvents(month: CalendarMonth) {
  const { from, to } = calendarWindowBounds(month);
  return apiGet<EsdevenimentsResponse>('/esdeveniments', { des_de: from, fins_a: to });
}

export function useCalendarEventsQuery(month: CalendarMonth) {
  return useQuery({
    queryKey: ['calendar', month.year, month.month],
    queryFn: () => fetchCalendarEvents(month),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

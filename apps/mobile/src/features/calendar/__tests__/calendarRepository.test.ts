import { apiGet } from '@/core/api/httpClient';

import { fetchCalendarEvents } from '../calendarRepository';

jest.mock('@/core/api/httpClient', () => ({ apiGet: jest.fn() }));

const mockedApiGet = jest.mocked(apiGet);

describe('fetchCalendarEvents', () => {
  beforeEach(() => mockedApiGet.mockReset());

  it('consulta també les setmanes adjacents a octubre', async () => {
    mockedApiGet.mockResolvedValue({ data: [] });

    await fetchCalendarEvents({ year: 2026, month: 9 });

    expect(mockedApiGet).toHaveBeenCalledWith('/esdeveniments', {
      des_de: '2026-09-28',
      fins_a: '2026-11-01',
    });
  });

  it('consulta novembre amb el mateix contracte', async () => {
    mockedApiGet.mockResolvedValue({ data: [] });

    await fetchCalendarEvents({ year: 2026, month: 10 });

    expect(mockedApiGet).toHaveBeenCalledWith('/esdeveniments', {
      des_de: '2026-10-26',
      fins_a: '2026-12-06',
    });
  });
});

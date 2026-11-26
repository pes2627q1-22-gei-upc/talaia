import { act, renderHook, waitFor } from '@testing-library/react-native';

import { plan } from '../__fixtures__/plan';
import { CalendarPermissionError, planCalendarRepository } from '../planCalendarRepository';
import { plansRepository } from '../plansRepository';
import { usePlanCalendar } from '../usePlanCalendar';

jest.mock('../planCalendarRepository', () => ({
  ...jest.requireActual('../planCalendarRepository'),
  planCalendarRepository: {
    isSupported: jest.fn(() => true),
    requestCalendars: jest.fn(),
    createEvent: jest.fn(),
    eventExists: jest.fn(),
    updateEvent: jest.fn(),
  },
}));
jest.mock('../plansRepository', () => ({ plansRepository: { linkCalendar: jest.fn() } }));

const request = jest.mocked(planCalendarRepository.requestCalendars);
const create = jest.mocked(planCalendarRepository.createEvent);
const link = jest.mocked(plansRepository.linkCalendar);
const calendars = [
  { id: 'google', title: 'Personal', account: 'Google' },
  { id: 'local', title: 'Local', account: '' },
];

beforeEach(() => {
  jest.clearAllMocks();
  request.mockResolvedValue({ status: 'ready', calendars });
  create.mockResolvedValue('native-event-1');
  link.mockResolvedValue(undefined);
});

it('no demana res en entrar: carrega els calendaris només en activar l’opció', async () => {
  const { result } = await renderHook(() => usePlanCalendar());
  expect(result.current.enabled).toBe(false);
  expect(request).not.toHaveBeenCalled();
  await act(() => result.current.toggle(true));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.selectedId).toBe('google');
  await act(() => result.current.select('local'));
  await act(() => result.current.setup());
  expect(result.current.selectedId).toBe('local');
});

it('ignora una resposta que arriba després de desactivar l’opció', async () => {
  let resolve: (value: Awaited<ReturnType<typeof request>>) => void = () => {};
  request.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = await renderHook(() => usePlanCalendar());
  await act(() => result.current.toggle(true));
  await act(() => result.current.toggle(false));
  await act(() => resolve({ status: 'ready', calendars }));
  expect(result.current.enabled).toBe(false);
  expect(result.current.calendars).toEqual([]);
});

it('reflecteix permís denegat, error de càrrega i calendari buit, i permet reintentar', async () => {
  const { result } = await renderHook(() => usePlanCalendar());
  request.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });
  await act(() => result.current.toggle(true));
  await waitFor(() => expect(result.current.status).toBe('denied'));
  expect(result.current.canAskAgain).toBe(false);
  request.mockRejectedValueOnce(new Error('native failure'));
  await act(() => result.current.setup());
  expect(result.current.status).toBe('error');
  request.mockResolvedValueOnce({ status: 'ready', calendars: [] });
  await act(() => result.current.setup());
  expect(result.current.selectedId).toBeNull();
  await act(() => result.current.setup());
  expect(result.current.selectedId).toBe('google');
});

it('crea l’esdeveniment i després desa el vincle, sense duplicar-lo si falla el PUT', async () => {
  link.mockRejectedValueOnce(new Error('offline'));
  const { result } = await renderHook(() => usePlanCalendar());
  await act(async () => expect(await result.current.sync(plan, 'Talaia', 'google')).toBe(false));
  expect(result.current.error).toBe('link');
  await act(async () => expect(await result.current.sync(plan, 'Talaia', 'google')).toBe(true));
  expect(create).toHaveBeenCalledTimes(1);
  expect(link).toHaveBeenCalledTimes(2);
  expect(link).toHaveBeenLastCalledWith(plan.id, { calendariEventId: 'native-event-1' });
  expect(result.current.error).toBeNull();
});

it('un error natiu no vincula res i es pot reintentar', async () => {
  create.mockRejectedValueOnce(new Error('calendar removed'));
  const { result } = await renderHook(() => usePlanCalendar());
  await act(async () => {
    await result.current.sync(plan, 'Talaia', 'google');
  });
  expect(result.current.error).toBe('create');
  expect(link).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.sync(plan, 'Talaia', 'google');
  });
  expect(link).toHaveBeenCalledTimes(1);
});

it('distingeix la revocació de permisos i evita dos esdeveniments amb un doble toc', async () => {
  create.mockRejectedValueOnce(new CalendarPermissionError(false));
  const { result } = await renderHook(() => usePlanCalendar());
  await act(async () => {
    await result.current.sync(plan, 'Talaia', 'google');
  });
  expect(result.current.error).toBe('denied');
  expect(result.current.canAskAgain).toBe(false);
  create.mockClear();
  await act(async () => {
    await Promise.all([
      result.current.sync(plan, 'Talaia', 'google'),
      result.current.sync(plan, 'Talaia', 'google'),
    ]);
  });
  expect(create).toHaveBeenCalledTimes(1);
});

describe('update: l’esdeveniment d’un pla editat (TG-161)', () => {
  const exists = jest.mocked(planCalendarRepository.eventExists);
  const updateEvent = jest.mocked(planCalendarRepository.updateEvent);
  const supported = jest.mocked(planCalendarRepository.isSupported);
  const previous = { ...plan, calendariEventId: 'native-event-1' };
  const edited = { ...previous, dataHoraInici: '2026-10-21T22:00:00.000Z', notes: 'Termo' };

  beforeEach(() => {
    supported.mockReturnValue(true);
    exists.mockResolvedValue(true);
    updateEvent.mockResolvedValue(undefined);
  });

  it('amb l’esdeveniment al mòbil, el busca amb el pla d’abans i hi escriu el nou', async () => {
    const { result } = await renderHook(() => usePlanCalendar());
    await expect(result.current.update(previous, edited, 'Talaia · Montsec')).resolves.toBe(
      'updated',
    );
    expect(exists).toHaveBeenCalledWith(previous);
    expect(updateEvent).toHaveBeenCalledWith('native-event-1', {
      title: 'Talaia · Montsec',
      location: 'Serra del Montsec, Àger',
      startDate: '2026-10-21T22:00:00.000Z',
      endDate: '2026-10-22T00:00:00.000Z',
      notes: 'Termo',
      timeZone: 'Europe/Madrid',
    });
  });

  it('si no és en aquest mòbil, missing i no l’actualitza', async () => {
    exists.mockResolvedValue(false);
    const { result } = await renderHook(() => usePlanCalendar());
    await expect(result.current.update(previous, edited, 'T')).resolves.toBe('missing');
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('sense esdeveniment vinculat o sense calendari (Expo Go), no crida res', async () => {
    const { result } = await renderHook(() => usePlanCalendar());
    await expect(result.current.update(plan, edited, 'T')).resolves.toBe('skipped');
    supported.mockReturnValue(false);
    const { result: expoGo } = await renderHook(() => usePlanCalendar());
    await expect(expoGo.current.update(previous, edited, 'T')).resolves.toBe('skipped');
    expect(exists).not.toHaveBeenCalled();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('un error del calendari o del permís no fa fallar res: el pla ja és desat', async () => {
    updateEvent.mockRejectedValueOnce(new Error('boom'));
    const { result } = await renderHook(() => usePlanCalendar());
    await expect(result.current.update(previous, edited, 'T')).resolves.toBe('failed');
    exists.mockRejectedValueOnce(new CalendarPermissionError(false));
    await expect(result.current.update(previous, edited, 'T')).resolves.toBe('denied');
    await waitFor(() => expect(result.current.canAskAgain).toBe(false));
    expect(result.current.syncing).toBe(false);
  });
});

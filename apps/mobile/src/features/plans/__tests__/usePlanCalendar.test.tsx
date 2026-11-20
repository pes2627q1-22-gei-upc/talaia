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

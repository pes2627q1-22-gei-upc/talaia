import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { plan } from '../__fixtures__/plan';
import { planCalendarEvent } from '../planCalendarModel';
import { CalendarPermissionError, planCalendarRepository } from '../planCalendarRepository';

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  isRunningInExpoGo: jest.fn(() => false),
  requireOptionalNativeModule: jest.fn(() => ({})),
}));
jest.mock('expo-calendar', () => ({
  getCalendarPermissions: jest.fn(),
  requestCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  ExpoCalendar: { get: jest.fn() },
  ExpoCalendarEvent: { get: jest.fn() },
  EntityTypes: { EVENT: 'event' },
}));

const permission = (granted: boolean, canAskAgain = true) =>
  ({
    granted,
    canAskAgain,
    status: granted ? 'granted' : 'denied',
    expires: 'never',
  }) as Calendar.PermissionResponse;
const getPermission = jest.mocked(Calendar.getCalendarPermissions);
const requestPermission = jest.mocked(Calendar.requestCalendarPermissions);
const getCalendars = jest.mocked(Calendar.getCalendars);
const getCalendar = jest.mocked(Calendar.ExpoCalendar.get);
const target = (overrides = {}) =>
  ({
    id: 'google',
    title: 'Personal',
    source: { name: 'Google' },
    allowsModifications: true,
    ...overrides,
  }) as unknown as Calendar.ExpoCalendar;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  jest.mocked(requireOptionalNativeModule).mockReturnValue({} as never);
  getPermission.mockResolvedValue(permission(true));
  getCalendars.mockResolvedValue([
    target(),
    target({ id: 'read-only', allowsModifications: false }),
  ]);
});

it('demana permís només quan cal i només ofereix calendaris modificables, amb el compte', async () => {
  getPermission.mockResolvedValue(permission(false));
  requestPermission.mockResolvedValue(permission(true));
  await expect(planCalendarRepository.requestCalendars()).resolves.toEqual({
    status: 'ready',
    calendars: [{ id: 'google', title: 'Personal', account: 'Google' }],
  });
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(getCalendars).toHaveBeenCalledWith('event');
});

it('amb permís concedit no torna a demanar-lo', async () => {
  await planCalendarRepository.requestCalendars();
  expect(requestPermission).not.toHaveBeenCalled();
});

it('sense permís i sense possibilitat de tornar-lo a demanar no llegeix els calendaris', async () => {
  getPermission.mockResolvedValue(permission(false, false));
  await expect(planCalendarRepository.requestCalendars()).resolves.toEqual({
    status: 'denied',
    canAskAgain: false,
  });
  expect(requestPermission).not.toHaveBeenCalled();
  expect(getCalendars).not.toHaveBeenCalled();
});

it('a Expo Go no crida cap API nativa', async () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  expect(planCalendarRepository.isSupported()).toBe(false);
  await expect(planCalendarRepository.requestCalendars()).resolves.toEqual({
    status: 'unavailable',
  });
  expect(getPermission).not.toHaveBeenCalled();
  expect(requireOptionalNativeModule).not.toHaveBeenCalled();
  await expect(
    planCalendarRepository.createEvent('google', planCalendarEvent(plan, 'Talaia')),
  ).rejects.toThrow('calendar_unavailable');
});

it('un build sense CalendarNext i la web no ofereixen calendari', () => {
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  expect(planCalendarRepository.isSupported()).toBe(false);
  jest.replaceProperty(Platform, 'OS', 'web');
  expect(planCalendarRepository.isSupported()).toBe(false);
  jest.restoreAllMocks();
});

it('ofereix calendari en una build nativa amb CalendarNext', () => {
  expect(planCalendarRepository.isSupported()).toBe(true);
});

it('crea l’esdeveniment al calendari triat i retorna el seu identificador', async () => {
  const createEvent = jest.fn(async () => ({ id: 'event-123' }));
  getCalendar.mockResolvedValue(target({ createEvent }));
  const event = planCalendarEvent(plan, 'Talaia');
  await expect(planCalendarRepository.createEvent('google', event)).resolves.toBe('event-123');
  expect(getCalendar).toHaveBeenCalledWith('google');
  expect(createEvent).toHaveBeenCalledWith(event);
});

it('torna a comprovar el permís i que el calendari encara sigui modificable en desar', async () => {
  getPermission.mockResolvedValue(permission(false, false));
  await expect(
    planCalendarRepository.createEvent('google', planCalendarEvent(plan, 'Talaia')),
  ).rejects.toBeInstanceOf(CalendarPermissionError);
  expect(getCalendar).not.toHaveBeenCalled();
  getPermission.mockResolvedValue(permission(true));
  getCalendar.mockResolvedValue(target({ allowsModifications: false }));
  await expect(
    planCalendarRepository.createEvent('google', planCalendarEvent(plan, 'Talaia')),
  ).rejects.toThrow('calendar_read_only');
});

describe('deleteEvent (TG-162)', () => {
  const getEvent = jest.mocked(Calendar.ExpoCalendarEvent.get);
  const linked = { ...plan, calendariEventId: 'event-1' };
  const remove = jest.fn(async () => undefined);
  const deviceEvent = (overrides = {}) =>
    ({
      ...planCalendarEvent(linked, 'Cel estrellat · Montsec'),
      delete: remove,
      ...overrides,
    }) as unknown as Calendar.ExpoCalendarEvent;

  it("esborra l'esdeveniment si és el del pla, sense demanar permís", async () => {
    getEvent.mockResolvedValue(deviceEvent());
    await expect(planCalendarRepository.deleteEvent(linked)).resolves.toBe(true);
    expect(getEvent).toHaveBeenCalledWith('event-1');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('no toca un esdeveniment amb el mateix id que no és el del pla (un altre mòbil)', async () => {
    getEvent.mockResolvedValue(deviceEvent({ startDate: '2026-10-21T18:00:00.000Z' }));
    await expect(planCalendarRepository.deleteEvent(linked)).resolves.toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("si l'esdeveniment ja no hi és, no fa res", async () => {
    getEvent.mockRejectedValue(new Error('event not found'));
    await expect(planCalendarRepository.deleteEvent(linked)).resolves.toBe(false);
  });

  it('sense permís, sense vincle o a Expo Go, ni el busca', async () => {
    getPermission.mockResolvedValue(permission(false));
    await expect(planCalendarRepository.deleteEvent(linked)).resolves.toBe(false);
    getPermission.mockResolvedValue(permission(true));
    await expect(planCalendarRepository.deleteEvent(plan)).resolves.toBe(false);
    jest.mocked(isRunningInExpoGo).mockReturnValue(true);
    await expect(planCalendarRepository.deleteEvent(linked)).resolves.toBe(false);
    expect(getEvent).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('esdeveniment d’un pla editat (TG-161)', () => {
  const getEvent = jest.mocked(Calendar.ExpoCalendarEvent.get);
  const linked = { ...plan, calendariEventId: 'event-123' };
  const nativeEvent = (overrides = {}) =>
    ({
      id: 'event-123',
      startDate: plan.dataHoraInici,
      endDate: plan.dataHoraFi,
      location: 'Serra del Montsec, Àger',
      update: jest.fn(async () => undefined),
      ...overrides,
    }) as unknown as Calendar.ExpoCalendarEvent;

  it('eventExists: l’esdeveniment del pla, si és en aquest mòbil i encara és el que es va crear', async () => {
    getEvent.mockResolvedValue(nativeEvent());
    await expect(planCalendarRepository.eventExists(linked)).resolves.toBe(true);
    expect(getEvent).toHaveBeenCalledWith('event-123');
    // Mogut per l'usuari, o un altre esdeveniment amb el mateix id en un altre mòbil: no es toca.
    getEvent.mockResolvedValue(nativeEvent({ startDate: '2026-10-21T19:00:00.000Z' }));
    await expect(planCalendarRepository.eventExists(linked)).resolves.toBe(false);
  });

  it('eventExists: false si l’esdeveniment no existeix (get llança) o el pla no en té', async () => {
    getEvent.mockRejectedValue(new Error('Event not found'));
    await expect(planCalendarRepository.eventExists(linked)).resolves.toBe(false);
    await expect(planCalendarRepository.eventExists(plan)).resolves.toBe(false);
  });

  it('eventExists: sense permís, CalendarPermissionError; a Expo Go, false sense tocar res', async () => {
    getPermission.mockResolvedValue(permission(false, false));
    await expect(planCalendarRepository.eventExists(linked)).rejects.toBeInstanceOf(
      CalendarPermissionError,
    );
    jest.mocked(isRunningInExpoGo).mockReturnValue(true);
    getPermission.mockClear();
    await expect(planCalendarRepository.eventExists(linked)).resolves.toBe(false);
    expect(getPermission).not.toHaveBeenCalled();
  });

  it('updateEvent escriu el títol, les hores, la ubicació i les notes del pla', async () => {
    const event = nativeEvent();
    getEvent.mockResolvedValue(event);
    const details = planCalendarEvent({ ...plan, notes: 'Termo' }, 'Oriònides · Montsec');
    await planCalendarRepository.updateEvent('event-123', details);
    expect(getEvent).toHaveBeenCalledWith('event-123');
    expect(event.update).toHaveBeenCalledWith(details);
  });

  it('updateEvent: sense permís (i sense poder-lo demanar) o sense calendari, error', async () => {
    getPermission.mockResolvedValue(permission(false, true));
    requestPermission.mockResolvedValue(permission(false, false));
    await expect(
      planCalendarRepository.updateEvent('event-123', planCalendarEvent(plan, 'T')),
    ).rejects.toBeInstanceOf(CalendarPermissionError);
    jest.mocked(isRunningInExpoGo).mockReturnValue(true);
    await expect(
      planCalendarRepository.updateEvent('event-123', planCalendarEvent(plan, 'T')),
    ).rejects.toThrow('calendar_unavailable');
  });
});

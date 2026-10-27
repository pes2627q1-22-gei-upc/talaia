import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { watchDeviceHeading } from '../headingRepository';
import { useDeviceHeading } from '../useDeviceHeading';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('../headingRepository', () => ({ watchDeviceHeading: jest.fn() }));
const watch = jest.mocked(watchDeviceHeading);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});

it('no activa la brúixola sense ubicació autoritzada', async () => {
  const { result } = await renderHook(() => useDeviceHeading(false));
  expect(watch).not.toHaveBeenCalled();
  expect(result.current.heading).toBeNull();
});

it('actualitza la direcció i atura el sensor en desmuntar', async () => {
  const remove = jest.fn();
  watch.mockResolvedValue({ remove });
  const { result, unmount } = await renderHook(() => useDeviceHeading(true));
  await act(() => watch.mock.calls[0]![0](359));
  expect(result.current.heading).toBe(359);
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

describe('amb el rellotge controlat', () => {
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  async function mount() {
    watch.mockResolvedValue({ remove: jest.fn() });
    const hook = await renderHook(() => useDeviceHeading(true));
    const send = async (value: number | null, afterMs = 0) => {
      await act(async () => {
        jest.advanceTimersByTime(afterMs);
        watch.mock.calls[0]![0](value);
      });
    };
    return { ...hook, send };
  }

  it('esmorteeix el soroll de la brúixola en lloc de seguir cada salt', async () => {
    const { result, send } = await mount();
    await send(90);
    for (const value of [120, 60, 115, 65, 110]) await send(value, 60);
    expect(Math.abs(result.current.heading! - 90)).toBeLessThan(15);
  });

  it('gira pel nord per la banda curta', async () => {
    const { result, send } = await mount();
    await send(350);
    await send(10, 100);
    const heading = result.current.heading!;
    expect(heading > 350 || heading < 10).toBe(true);
  });

  it('quan el sensor calla, acaba a l’última lectura', async () => {
    const { result, send } = await mount();
    await send(0);
    await send(90, 60);
    expect(result.current.heading).toBeLessThan(90);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.heading).toBe(90);
  });

  it('una lectura sense calibrar no amaga la fletxa; si duren, sí', async () => {
    const { result, send } = await mount();
    await send(45);
    await send(null, 60);
    await send(46, 500);
    expect(result.current.heading).not.toBeNull();
    await send(null, 60);
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(result.current.heading).toBeNull();
  });
});

it('retira una subscripció que arriba després de sortir del mapa', async () => {
  let resolve!: (value: { remove(): void }) => void;
  watch.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { unmount } = await renderHook(() => useDeviceHeading(true));
  await unmount();
  const remove = jest.fn();
  await act(async () => {
    resolve({ remove });
  });
  expect(remove).toHaveBeenCalledTimes(1);
});

it('deixa el punt disponible si no hi ha sensor', async () => {
  watch.mockRejectedValue(new Error('heading unavailable'));
  const { result } = await renderHook(() => useDeviceHeading(true));
  expect(result.current.heading).toBeNull();
  expect(result.current.active).toBe(true);
});

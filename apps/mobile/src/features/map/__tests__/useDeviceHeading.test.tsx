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
  await act(() => watch.mock.calls[0]![0](null));
  expect(result.current.heading).toBeNull();
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
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

import { act, renderHook } from '@testing-library/react-native';
import * as Brightness from 'expo-brightness';
import { AppState, type AppStateStatus } from 'react-native';

import { NIGHT_BRIGHTNESS, useNightBrightness } from '../useNightBrightness';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(),
  setBrightnessAsync: jest.fn(),
}));

const get = jest.mocked(Brightness.getBrightnessAsync);
const set = jest.mocked(Brightness.setBrightnessAsync);
let changeAppState: (state: AppStateStatus) => void;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue(0.7);
  set.mockResolvedValue();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    changeAppState = listener;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

// Deixa córrer la cua de crides a la brillantor.
const flush = () => act(async () => {});

describe('useNightBrightness', () => {
  it('fora del mode nit no toca la brillantor', async () => {
    await renderHook(() => useNightBrightness(false));
    await flush();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('en entrar la baixa i en sortir torna la d’abans', async () => {
    const { rerender } = await renderHook(
      ({ active }: { active: boolean }) => useNightBrightness(active),
      {
        initialProps: { active: true },
      },
    );
    await flush();
    expect(set).toHaveBeenLastCalledWith(NIGHT_BRIGHTNESS);

    await rerender({ active: false });
    await flush();
    expect(set).toHaveBeenLastCalledWith(0.7);
  });

  it('si surt del mode abans que arribi la brillantor, no la deixa baixa', async () => {
    let resolve!: (value: number) => void;
    get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { rerender } = await renderHook(
      ({ active }: { active: boolean }) => useNightBrightness(active),
      {
        initialProps: { active: true },
      },
    );
    await rerender({ active: false });
    resolve(0.7);
    await flush();
    expect(set.mock.calls).toEqual([[NIGHT_BRIGHTNESS], [0.7]]);
  });

  it('la torna en passar a segon pla i la baixa en tornar', async () => {
    await renderHook(() => useNightBrightness(true));
    await flush();
    set.mockClear();

    await act(async () => changeAppState('background'));
    expect(set).toHaveBeenLastCalledWith(0.7);
    await act(async () => changeAppState('active'));
    expect(set).toHaveBeenLastCalledWith(NIGHT_BRIGHTNESS);
  });

  it('no la torna a baixar si l’usuari l’ha pujada des del Centre de control', async () => {
    await renderHook(() => useNightBrightness(true));
    await flush();
    set.mockClear();

    await act(async () => changeAppState('inactive'));
    await act(async () => changeAppState('active'));
    expect(set).not.toHaveBeenCalled();
  });
});

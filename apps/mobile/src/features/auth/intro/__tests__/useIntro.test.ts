import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';

import { TL } from '../timeline';
import { INTRO_HAPTICS, INTRO_LEAD, INTRO_SEEN_KEY, SKIP_DURATION, useIntro } from '../useIntro';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft' },
}));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

function vibrations() {
  return (
    jest.mocked(Haptics.impactAsync).mock.calls.length +
    jest.mocked(Haptics.selectionAsync).mock.calls.length
  );
}

async function renderIntro(forceFull?: boolean) {
  const hook = await renderHook(() => useIntro(forceFull));
  await act(async () => {});
  return hook;
}

describe('useIntro', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('el primer cop és sencera, vibra al seu ritme i queda apuntada en acabar', async () => {
    const { result } = await renderIntro();
    expect(result.current.mode).toBe('full');
    expect(await AsyncStorage.getItem(INTRO_SEEN_KEY)).toBeNull();

    await act(() => jest.advanceTimersByTime(INTRO_LEAD + TL.end));

    expect(vibrations()).toBe(INTRO_HAPTICS.length);
    expect(await AsyncStorage.getItem(INTRO_SEEN_KEY)).toBe('1');
  });

  it("si ja s'ha vist és curta, tret que es demani sencera", async () => {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
    expect((await renderIntro()).result.current.mode).toBe('short');
    expect((await renderIntro(true)).result.current.mode).toBe('full');
  });

  it("si no es pot llegir si ja s'ha vist, fa la curta", async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('sense disc'));
    expect((await renderIntro()).result.current.mode).toBe('short');
  });

  it('amb «reduir moviment» és quieta, ja acabada i sense vibracions', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const { result } = await renderIntro();
    expect(result.current.mode).toBe('still');
    expect(result.current.t.get()).toBe(TL.end);

    await act(() => jest.advanceTimersByTime(INTRO_LEAD + TL.end));
    expect(vibrations()).toBe(0);
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('saltar-la la porta al final de seguida, sense més vibracions', async () => {
    const { result } = await renderIntro();
    await act(() => jest.advanceTimersByTime(INTRO_LEAD + 500));
    const before = vibrations();

    await act(() => result.current.skip());
    await act(() => jest.advanceTimersByTime(SKIP_DURATION + 100));
    expect(result.current.t.get()).toBe(TL.end);
    expect(await AsyncStorage.getItem(INTRO_SEEN_KEY)).toBe('1');

    await act(() => jest.advanceTimersByTime(TL.end));
    expect(vibrations()).toBe(before);

    jest.mocked(AsyncStorage.setItem).mockClear();
    await act(() => result.current.skip());
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

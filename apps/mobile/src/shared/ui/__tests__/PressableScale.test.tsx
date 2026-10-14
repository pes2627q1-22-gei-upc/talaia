import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '../PressableScale';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
// Tota la resta de Reanimated és la real; només es pot activar «reduir moviment».
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

function renderPressable(props: Partial<Parameters<typeof PressableScale>[0]> = {}) {
  return render(
    <PressableScale accessibilityLabel="Desa" {...props}>
      <Text>Desa</Text>
    </PressableScale>,
  );
}

describe('PressableScale', () => {
  beforeEach(() => jest.clearAllMocks());

  it("s'enfonsa en prémer i torna en deixar-lo, i avisa qui ho escolta", async () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await renderPressable({ onPressIn, onPressOut });
    const button = screen.getByRole('button', { name: 'Desa' });
    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('amb «reduir moviment» no anima, però continua responent', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await renderPressable({ onPressIn, onPressOut });
    const button = screen.getByRole('button', { name: 'Desa' });
    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('les accions clau vibren amb un cop lleu', async () => {
    const onPress = jest.fn();
    await renderPressable({ onPress, haptic: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Desa' }));
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('els xips i controls de selecció fan el tic de selecció', async () => {
    await renderPressable({ haptic: 'selection' });
    await fireEvent.press(screen.getByRole('button', { name: 'Desa' }));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('sense `haptic` no vibra', async () => {
    await renderPressable();
    await fireEvent.press(screen.getByRole('button', { name: 'Desa' }));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });
});

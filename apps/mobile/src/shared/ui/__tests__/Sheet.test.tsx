import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { motion } from '@/core/theme/tokens';

import { Sheet } from '../Sheet';

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function sheet(visible: boolean, onClose = jest.fn()) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <Sheet visible={visible} onClose={onClose} title="Franja horària" closeLabel="Fet">
        <Text>Contingut</Text>
      </Sheet>
    </SafeAreaProvider>
  );
}

const renderSheet = (visible: boolean, onClose = jest.fn()) => render(sheet(visible, onClose));

describe('Sheet', () => {
  it('tancat, no hi ha res', async () => {
    await renderSheet(false);
    expect(screen.queryByText('Franja horària')).toBeNull();
  });

  it('obert, mostra el títol i el contingut, i es tanca tocant fora', async () => {
    const onClose = jest.fn();
    await renderSheet(true, onClose);
    expect(screen.getByRole('header', { name: 'Franja horària' })).toBeOnTheScreen();
    expect(screen.getByText('Contingut')).toBeOnTheScreen();

    // El full és modal per a VoiceOver: el fons hi queda amagat, però es pot tocar.
    await fireEvent.press(screen.getByRole('button', { name: 'Fet', includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('en tancar-se, fa la sortida i després desapareix', async () => {
    jest.useFakeTimers();
    const view = await renderSheet(true);
    await view.rerender(sheet(false));
    expect(screen.getByText('Contingut')).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTime(motion.base + 100));
    expect(screen.queryByText('Contingut')).toBeNull();
    jest.useRealTimers();
  });
});

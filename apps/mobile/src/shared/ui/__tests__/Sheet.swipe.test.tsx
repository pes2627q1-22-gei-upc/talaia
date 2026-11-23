import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Sheet } from '../Sheet';

async function setup() {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <Sheet visible title="Idioma" closeLabel="Tanca" onClose={onClose} swipeToClose />
    </SafeAreaProvider>,
  );
  const swipe = async (translationY: number, velocityY = 0) => {
    await act(() =>
      fireGestureHandler(getByGestureTestId('sheet-swipe-down'), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 0 },
        { state: State.ACTIVE, translationY },
        { state: State.END, translationY, velocityY },
      ]),
    );
  };
  return { onClose, swipe };
}

it('un lliscament curt deixa el full obert; un de llarg el tanca', async () => {
  const { onClose, swipe } = await setup();
  await swipe(30);
  expect(onClose).not.toHaveBeenCalled();
  await swipe(90);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('un lliscament curt i ràpid també tanca el full', async () => {
  const { onClose, swipe } = await setup();
  await swipe(30, 1000);
  expect(onClose).toHaveBeenCalledTimes(1);
});

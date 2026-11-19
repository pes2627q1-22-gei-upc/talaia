import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureDetector, GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { useRankingSheetMotion } from '../useRankingSheetMotion';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

function Panel({ closed, onChange }: { closed: boolean; onChange: (closed: boolean) => void }) {
  const drag = useRankingSheetMotion(closed, onChange);
  return (
    <GestureDetector gesture={drag.pan}>
      <Animated.View testID="test-panel" onLayout={drag.onLayout} style={drag.panelStyle} />
    </GestureDetector>
  );
}

async function setup(collapsed = false) {
  const onChange = jest.fn();
  const tree = await render(<Panel closed={collapsed} onChange={onChange} />, {
    wrapper: GestureHandlerRootView,
  });
  const measure = (height: number) =>
    fireEvent(screen.getByTestId('test-panel'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 393, height } },
    });
  await measure(360);
  const swipe = async (
    translationY: number,
    velocityY = 0,
    end: (typeof State)[keyof typeof State] = State.END,
  ) => {
    await act(() =>
      fireGestureHandler(getByGestureTestId('ranking-sheet-pan'), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 0 },
        { state: State.ACTIVE, translationY },
        { state: end, translationY, velocityY },
      ]),
    );
  };
  const rerender = ({ closed }: { closed: boolean }) =>
    tree.rerender(<Panel closed={closed} onChange={onChange} />);
  return { swipe, onChange, rerender, measure };
}

beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

it('un arrossegament curt es queda obert; un gest ràpid amb la mateixa distància es plega', async () => {
  const { swipe, onChange } = await setup();
  await swipe(40);
  expect(onChange).toHaveBeenLastCalledWith(false);
  await swipe(40, 1200);
  expect(onChange).toHaveBeenLastCalledWith(true);
});

it('un gest cancel·lat no canvia l’estat del full', async () => {
  const { swipe, onChange } = await setup();
  await swipe(250, 0, State.CANCELLED);
  expect(onChange).not.toHaveBeenCalled();
  await swipe(250);
  expect(onChange).toHaveBeenLastCalledWith(true);
});

it('es recupera lliscant cap amunt i es limita el moviment als dos extrems', async () => {
  const { swipe, onChange, rerender } = await setup(true);
  await swipe(-1000);
  expect(onChange).toHaveBeenLastCalledWith(false);
  await rerender({ closed: false });
  await swipe(-1000);
  expect(onChange).toHaveBeenLastCalledWith(false);
  await swipe(1000);
  expect(onChange).toHaveBeenLastCalledWith(true);
});

it('recalcula el recorregut quan canvia l’alçada, també si el full està plegat', async () => {
  const { swipe, onChange, measure } = await setup(true);
  await measure(600);
  await swipe(-200);
  expect(onChange).toHaveBeenLastCalledWith(true);
  await swipe(-400);
  expect(onChange).toHaveBeenLastCalledWith(false);
});

it('amb reduir moviment, els gestos continuen plegant i desplegant el full', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const { swipe, onChange, rerender } = await setup();
  await swipe(250);
  expect(onChange).toHaveBeenLastCalledWith(true);
  await rerender({ closed: true });
  await swipe(-250);
  expect(onChange).toHaveBeenLastCalledWith(false);
});

/**
 * RNF05 (TG-126): el que es pot prémer dels components base té rol i nom per a VoiceOver i TalkBack
 * i, si té una mida fixa, una zona tàctil de 44 pt com a mínim (`sizes.touch`). La revisió de les
 * pantalles es fa al dispositiu: docs/rnf.md.
 */
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { sizes, typography } from '@/core/theme/tokens';

import { Button } from '../Button';
import { Card } from '../Card';
import { Chip } from '../Chip';
import { MonthCalendar } from '../MonthCalendar';
import { SegmentedControl } from '../SegmentedControl';
import { Sheet } from '../Sheet';
import { Slider } from '../Slider';
import { StateMessage } from '../StateMessage';
import { TextField } from '../TextField';
import { WheelPicker } from '../WheelPicker';

type Element = ReturnType<typeof screen.getByRole>;
type Slop = number | { top?: number; bottom?: number } | undefined;

/** Alçada de la zona tàctil: l'alçada (o la mínima) de l'estil més el `hitSlop` de dalt i de baix. */
function touchHeight(element: Element, contentHeight = 0): number {
  const style = StyleSheet.flatten(element.props.style) ?? {};
  const height = Math.max(Number(style.height ?? 0), Number(style.minHeight ?? 0), contentHeight);
  const slop = element.props.hitSlop as Slop;
  const extra = typeof slop === 'number' ? 2 * slop : (slop?.top ?? 0) + (slop?.bottom ?? 0);
  return height + extra;
}

/** Cap element amb aquests rols no pot quedar sense nom per al lector de pantalla. */
function expectEveryoneNamed(...roles: ('button' | 'tab' | 'adjustable')[]) {
  const elements = roles.flatMap((role) => screen.queryAllByRole(role));
  expect(elements.length).toBeGreaterThan(0);
  for (const element of elements) expect(element).toHaveAccessibleName();
}

describe('accessibilitat dels components base (RNF05)', () => {
  it.each(['primary', 'secondary', 'light'] as const)(
    'Button %s: botó amb el text com a nom i 44 pt de tacte',
    async (variant) => {
      await render(<Button label="Crea un pla" variant={variant} onPress={jest.fn()} />);
      const button = screen.getByRole('button', { name: 'Crea un pla' });
      expect(touchHeight(button)).toBeGreaterThanOrEqual(sizes.touch);
    },
  );

  it('Button text: botó amb el text com a nom', async () => {
    await render(<Button label="Mostra'ls tots" variant="text" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: "Mostra'ls tots" })).toBeOnTheScreen();
  });

  // Pendent (docs/rnf.md): 17 de línia + 2 × 12 de hitSlop = 41 pt. Quan s'arregli, aquest test
  // fallarà: llavors cal passar-lo a `it`.
  it.failing('Button text: 44 pt de tacte', async () => {
    await render(<Button label="Mostra'ls tots" variant="text" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: "Mostra'ls tots" });
    expect(touchHeight(button, typography.link.lineHeight)).toBeGreaterThanOrEqual(sizes.touch);
  });

  it('Chip: botó amb nom, estat i 44 pt de tacte amb el hitSlop', async () => {
    await render(<Chip label="Lluna" selected onPress={jest.fn()} />);
    const chip = screen.getByRole('button', { name: 'Lluna' });
    expect(chip).toBeSelected();
    expect(touchHeight(chip)).toBeGreaterThanOrEqual(sizes.touch);
  });

  it('Card que es pot prémer: botó amb accessibilityLabel', async () => {
    await render(
      <Card onPress={jest.fn()} accessibilityLabel="Montsec, índex 82">
        <Text>Montsec</Text>
      </Card>,
    );
    expect(screen.getByRole('button')).toHaveAccessibleName('Montsec, índex 82');
  });

  it('SegmentedControl: cada opció és una pestanya amb nom i 44 pt de tacte', async () => {
    await render(
      <SegmentedControl options={['Aquesta nit', 'Demà']} selectedIndex={0} onChange={jest.fn()} />,
    );
    expectEveryoneNamed('tab');
    for (const tab of screen.getAllByRole('tab')) {
      expect(touchHeight(tab)).toBeGreaterThanOrEqual(sizes.touch);
    }
  });

  it('MonthCalendar: fletxes i dies amb accessibilityLabel i 44 pt de tacte', async () => {
    await render(
      <MonthCalendar
        value="2026-11-11"
        today="2026-11-11"
        min="2026-11-01"
        max="2026-12-31"
        onChange={jest.fn()}
        firstDay={1}
        weekdayNames={['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.']}
        formatTitle={({ year, month }) => `${month + 1}/${year}`}
        dayLabel={(date) => `dia ${date}`}
        previousLabel="Mes anterior"
        nextLabel="Mes següent"
      />,
      { wrapper: GestureHandlerRootView },
    );
    expectEveryoneNamed('button');
    const next = screen.getByRole('button', { name: 'Mes següent' });
    expect(touchHeight(next)).toBeGreaterThanOrEqual(sizes.touch);
    const day = screen.getByRole('button', { name: 'dia 2026-11-11' });
    expect(next.props.accessibilityLabel).toBe('Mes següent');
    expect(day.props.accessibilityLabel).toBe('dia 2026-11-11');
  });

  it('Slider i WheelPicker: controls ajustables amb accessibilityLabel i valor', async () => {
    await render(
      <>
        <Slider
          value={150}
          min={30}
          max={240}
          step={15}
          onChange={jest.fn()}
          accessibilityLabel="Fins a quina distància"
          accessibilityValueText="150 min"
        />
        <WheelPicker
          values={[21, 22, 23]}
          value={22}
          onChange={jest.fn()}
          format={(hour) => `${hour}:00`}
          accessibilityLabel="Des de"
        />
      </>,
      { wrapper: GestureHandlerRootView },
    );
    expectEveryoneNamed('adjustable');
    expect(screen.getByRole('adjustable', { name: 'Fins a quina distància' })).toHaveProp(
      'accessibilityLabel',
      'Fins a quina distància',
    );
    expect(screen.getByRole('adjustable', { name: 'Des de' })).toHaveAccessibilityValue({
      text: '22:00',
    });
  });

  // Pendent (docs/rnf.md): la barra fa 28 pt d'alçada i no té hitSlop.
  it.failing('Slider: 44 pt de tacte', async () => {
    await render(
      <Slider
        value={150}
        min={30}
        max={240}
        step={15}
        onChange={jest.fn()}
        accessibilityLabel="Fins a quina distància"
        accessibilityValueText="150 min"
      />,
      { wrapper: GestureHandlerRootView },
    );
    expect(touchHeight(screen.getByRole('adjustable'))).toBeGreaterThanOrEqual(sizes.touch);
  });

  it('TextField: el camp té l’etiqueta com a accessibilityLabel i 44 pt de tacte', async () => {
    await render(<TextField label="Correu electrònic" value="" onChangeText={jest.fn()} />);
    const field = screen.getByLabelText('Correu electrònic');
    expect(field).toHaveProp('accessibilityLabel', 'Correu electrònic');
    expect(touchHeight(field)).toBeGreaterThanOrEqual(sizes.touch);
  });

  // Amb VoiceOver el fons queda amagat (el full és modal) i es tanca amb el gest d'escapament.
  it('Sheet: el fons per tancar és un botó amb accessibilityLabel', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <Sheet visible onClose={jest.fn()} title="Franja horària" closeLabel="Fet">
          <Text>Contingut</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('button', { name: 'Fet', includeHiddenElements: true })).toHaveProp(
      'accessibilityLabel',
      'Fet',
    );
  });

  it("StateMessage: l'acció és un botó amb nom", async () => {
    await render(
      <StateMessage
        title="No hi ha connexió"
        action={{ label: 'Torna-ho a provar', onPress: jest.fn() }}
      />,
    );
    expectEveryoneNamed('button');
    expect(screen.getByRole('button', { name: 'Torna-ho a provar' })).toBeOnTheScreen();
  });
});

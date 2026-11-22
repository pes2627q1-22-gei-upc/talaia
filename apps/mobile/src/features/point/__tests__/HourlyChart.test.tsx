import { render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { colors } from '@/core/theme/tokens';

import { HourlyChart } from '../HourlyChart';

type Hours = ComponentProps<typeof HourlyChart>['hours'];

const hour = (id: string, value: number, level: 'ras' | 'jus' | 'tap') =>
  ({
    id,
    label: id,
    date: id,
    value,
    level,
    isBest: false,
    factors: [],
    factorsTitle: '',
    accessibilityLabel: `${id}, ${value}`,
  }) as unknown as Hours[number];

async function renderSelected(value: number, level: 'ras' | 'jus' | 'tap') {
  await render(
    <HourlyChart
      hours={[hour('21', value, level)]}
      hoursLabel="Aquesta nit"
      timezoneLabel="Hora local"
      noHours="Sense hores"
      selectedHourId="21"
      onSelect={jest.fn()}
    />,
  );
}

describe('HourlyChart, la xifra de l’hora triada', () => {
  it('amb la barra a la meitat o més, va dins de la barra, en nit', async () => {
    await renderSelected(68, 'jus');
    expect(screen.getByTestId('selected-hour-index')).toHaveStyle({ top: '32%' });
    expect(screen.getByText('68')).toHaveStyle({ color: colors.nit });
  });

  it('amb la barra baixa, va a sobre de la barra, del color de la franja', async () => {
    await renderSelected(20, 'tap');
    expect(screen.getByTestId('selected-hour-index')).toHaveStyle({ bottom: '20%' });
    expect(screen.getByText('20')).toHaveStyle({ color: colors.tap });
  });
});

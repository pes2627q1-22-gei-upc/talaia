import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { ApiStatusCard } from '../ApiStatusCard';
import { useHealthQuery } from '../apiStatusRepository';

jest.mock('../apiStatusRepository', () => ({ useHealthQuery: jest.fn() }));

const refetch = jest.fn();
function health(overrides: Partial<ReturnType<typeof useHealthQuery>> = {}) {
  jest.mocked(useHealthQuery).mockReturnValue({
    data: undefined,
    isSuccess: false,
    isFetching: true,
    refetch,
    ...overrides,
  } as ReturnType<typeof useHealthQuery>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('ca');
  health();
});

it('mostra la comprovació de connexió sense reintent durant la càrrega', async () => {
  await render(<ApiStatusCard />);
  expect(screen.getByText('Comprovant la connexió…')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
});

it('presenta la versió rebuda del servidor', async () => {
  health({ data: { status: 'ok', version: '0.1.0' }, isFetching: false, isSuccess: true });
  await render(<ApiStatusCard />);
  expect(screen.getByText('Connectat · API v0.1.0')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
});

it('connecta el reintent a la consulta i actualitza el missatge quan es recupera', async () => {
  health({ isFetching: false });
  const view = await render(<ApiStatusCard />);
  expect(screen.getByText('No es pot connectar amb el servidor')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('apiStatus.retry') }));
  expect(refetch).toHaveBeenCalledTimes(1);
  health();
  await view.rerender(<ApiStatusCard />);
  expect(screen.getByText('Comprovant la connexió…')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
  health({ data: { status: 'ok', version: '0.1.0' }, isSuccess: true, isFetching: false });
  await view.rerender(<ApiStatusCard />);
  expect(screen.getByText('Connectat · API v0.1.0')).toBeOnTheScreen();
});

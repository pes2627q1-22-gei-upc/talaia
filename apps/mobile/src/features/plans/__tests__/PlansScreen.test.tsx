import type { Pla } from '@talaia/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { plan } from '../__fixtures__/plans';
import { PlansScreen } from '../PlansScreen';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('expo-haptics');

const get = jest.mocked(apiGet);
const push = jest.fn();
const navigate = jest.fn();
jest
  .mocked(useRouter)
  .mockReturnValue({ push, navigate } as unknown as ReturnType<typeof useRouter>);

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function serve(lists: { futurs: Pla[] | Error; passats: Pla[] | Error }) {
  get.mockImplementation((async (path: string, query?: Record<string, unknown>) => {
    if (path === '/esdeveniments') return { data: [] };
    const list = lists[query?.quan as 'futurs' | 'passats'];
    if (list instanceof Error) throw list;
    return list;
  }) as typeof apiGet);
}

async function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <SafeAreaProvider initialMetrics={METRICS}>
        <QueryWrapper>{children}</QueryWrapper>
      </SafeAreaProvider>
    );
  }
  await render(<PlansScreen />, { wrapper: Wrapper });
}

beforeEach(async () => {
  get.mockReset();
  push.mockReset();
  navigate.mockReset();
  await i18n.changeLanguage('ca');
});

it('ensenya els propers amb esquelets mentre carreguen i obre la fitxa en tocar-ne un', async () => {
  serve({ futurs: [plan()], passats: [] });
  await renderScreen();
  expect(screen.getByText('Els meus plans')).toBeOnTheScreen();
  expect(screen.getByTestId('plans-loading')).toBeOnTheScreen();
  const row = await screen.findByRole('button', {
    name: "Cel estrellat a Àger. 21 d'octubre. Sortida a les 23:15, Serra del Montsec",
  });
  expect(screen.getByText('21')).toBeOnTheScreen();
  expect(screen.getByText('OCT')).toBeOnTheScreen();
  expect(screen.getByText('Cel estrellat a Àger')).toBeOnTheScreen();
  expect(screen.getByText('Sortida a les 23:15, Serra del Montsec')).toBeOnTheScreen();
  expect(screen.queryByTestId('plans-loading')).toBeNull();
  await fireEvent.press(row);
  expect(push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
});

it("les pastilles canvien a «Passats»; un pla d'un punt retirat surt desactivat", async () => {
  const retired = plan({
    id: 'p0',
    punt: { id: 'prades', nom: 'Coll de Prades', municipi: 'Prades', publicat: false },
  });
  serve({ futurs: [plan()], passats: [retired] });
  await renderScreen();
  await screen.findByText('Cel estrellat a Àger');
  await fireEvent.press(screen.getByRole('button', { name: 'Passats' }));
  expect(screen.getByRole('button', { name: 'Passats' })).toBeSelected();
  expect(await screen.findByText('Cel estrellat a Prades')).toBeOnTheScreen();
  expect(screen.getByText('Aquest punt ja no està disponible.')).toBeOnTheScreen();
  expect(screen.queryByText('Cel estrellat a Àger')).toBeNull();
  const row = screen.getByTestId('plan-row-p0');
  expect(row).toBeDisabled();
  await fireEvent.press(row);
  expect(push).not.toHaveBeenCalled();
});

it('sense plans, el buit amb el botó cap a Explora (els passats, sense botó)', async () => {
  serve({ futurs: [], passats: [] });
  await renderScreen();
  expect(await screen.findByText('Encara no tens cap pla')).toBeOnTheScreen();
  expect(
    screen.getByText('Busca un bon lloc a Explora i crea un pla des de la seva fitxa.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Troba un lloc' }));
  expect(navigate).toHaveBeenCalledWith('/');

  await fireEvent.press(screen.getByRole('button', { name: 'Passats' }));
  expect(await screen.findByText('Encara no tens plans passats')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Troba un lloc' })).toBeNull();
});

it('un error es mostra amb «Torna-ho a provar», que torna a demanar els plans', async () => {
  serve({ futurs: new ApiError(500, 'internal', 'boom'), passats: [] });
  await renderScreen();
  expect(await screen.findByText('No hem pogut carregar els plans')).toBeOnTheScreen();
  serve({ futurs: [plan()], passats: [] });
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
  await waitFor(() => expect(screen.getByText('Cel estrellat a Àger')).toBeOnTheScreen());
});

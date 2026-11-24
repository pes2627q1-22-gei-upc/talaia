import type { Pla } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { useTheme } from '@/core/theme/theme';
import { useAuthState } from '@/features/auth/AuthProvider';
import { plan } from '@/features/plans/__fixtures__/plans';

import { nextNightEnd } from '../nightModeModel';
import { nightModeRepository } from '../nightModeRepository';
import { NightModeProvider, useNightMode } from '../NightModeProvider';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
  isUsingSystemBrightnessAsync: jest.fn().mockResolvedValue(true),
  restoreSystemBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuthState: jest.fn() }));
jest.mock('../nightModeRepository', () => ({
  nightModeRepository: { load: jest.fn(), save: jest.fn(), position: jest.fn() },
}));

const repo = jest.mocked(nightModeRepository);
const get = jest.mocked(apiGet);
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

const MONTSEC = { lat: 42.0254, lon: 0.7375 };
const HOUR = 60 * 60 * 1000;
const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

/** Un pla al Montsec que es fa ara mateix. */
const enFranja = (): Pla =>
  plan({
    id: 'p1',
    punt: { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger', publicat: true },
    dataHoraInici: new Date(Date.now() - HOUR).toISOString(),
    dataHoraFi: new Date(Date.now() + HOUR).toISOString(),
  });

function serve(plans: Pla[]) {
  get.mockImplementation((async (path: string) => {
    if (path === '/plans') return plans;
    if (path === '/punts') {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [MONTSEC.lon, MONTSEC.lat] },
            properties: { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger' },
          },
        ],
      };
    }
    throw new Error(`inesperat: ${path}`);
  }) as typeof apiGet);
}

function Probe() {
  const { name } = useTheme();
  const { on, setOn } = useNightMode();
  return (
    <Pressable accessibilityRole="button" onPress={() => setOn(!on)}>
      <Text testID="theme">{name}</Text>
    </Pressable>
  );
}

// El catàleg del mapa té un `gcTime` d'una hora: sense buidar el client, Jest no surt.
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

async function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <SafeAreaProvider initialMetrics={METRICS}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </SafeAreaProvider>
    );
  }
  await render(
    <NightModeProvider>
      <Probe />
    </NightModeProvider>,
    { wrapper: Wrapper },
  );
}

const theme = () => screen.getByTestId('theme');

beforeEach(async () => {
  jest.clearAllMocks();
  repo.load.mockResolvedValue(null);
  repo.save.mockResolvedValue(undefined);
  repo.position.mockResolvedValue(MONTSEC);
  jest
    .mocked(useAuthState)
    .mockReturnValue({ user: { id: 'u1' } } as ReturnType<typeof useAuthState>);
  serve([]);
  await i18n.changeLanguage('ca');
});

it("sense sessió, l'interruptor el posa en vermell fins a les 06:00 següents i ho desa", async () => {
  jest.mocked(useAuthState).mockReturnValue({ user: null } as ReturnType<typeof useAuthState>);
  await renderProvider();
  expect(theme()).toHaveTextContent('normal');
  await fireEvent.press(screen.getByRole('button'));
  expect(theme()).toHaveTextContent('vermell');
  expect(repo.save).toHaveBeenCalledWith({
    on: true,
    until: nextNightEnd(new Date()).getTime(),
  });
  expect(get).not.toHaveBeenCalled();
  expect(repo.position).not.toHaveBeenCalled();
});

it('una tria desada i vigent mana en obrir l’app; una de caducada, no', async () => {
  repo.load.mockResolvedValue({ on: true, until: Date.now() + HOUR });
  await renderProvider();
  await waitFor(() => expect(theme()).toHaveTextContent('vermell'));
  await screen.unmount();

  repo.load.mockResolvedValue({ on: true, until: Date.now() - 1 });
  await renderProvider();
  await waitFor(() => expect(repo.load).toHaveBeenCalledTimes(2));
  expect(theme()).toHaveTextContent('normal');
});

it('a prop del punt d’un pla en franja, s’activa sol i ho avisa; «Desactiva» el treu', async () => {
  serve([enFranja()]);
  await renderProvider();
  await waitFor(() => expect(theme()).toHaveTextContent('vermell'));
  expect(screen.getByText('Mode nit activat: ets a prop de Serra del Montsec.')).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Mode nit activat: ets a prop de Serra del Montsec.');

  await fireEvent.press(screen.getByRole('button', { name: 'Desactiva' }));
  expect(theme()).toHaveTextContent('normal');
  expect(screen.queryByTestId('night-mode-notice')).toBeNull();
  expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ on: false }));
});

it('lluny del punt, o sense permís de localització, no s’activa', async () => {
  serve([enFranja()]);
  repo.position.mockResolvedValue({ lat: MONTSEC.lat + 0.02, lon: MONTSEC.lon });
  await renderProvider();
  await waitFor(() => expect(repo.position).toHaveBeenCalled());
  expect(theme()).toHaveTextContent('normal');
  await screen.unmount();

  repo.position.mockResolvedValue(null);
  await renderProvider();
  await waitFor(() => expect(repo.position).toHaveBeenCalledTimes(2));
  expect(theme()).toHaveTextContent('normal');
  expect(screen.queryByTestId('night-mode-notice')).toBeNull();
});

it('fora de la franja no mira la ubicació ni demana el catàleg', async () => {
  serve([
    plan({
      id: 'demà',
      dataHoraInici: new Date(Date.now() + 24 * HOUR).toISOString(),
      dataHoraFi: null,
    }),
  ]);
  await renderProvider();
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/plans', { quan: 'futurs' }, expect.anything()),
  );
  expect(repo.position).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalledWith('/punts');
  expect(theme()).toHaveTextContent('normal');
});

it('amb una tria a mà vigent, ser a prop no canvia el tema ni avisa', async () => {
  repo.load.mockResolvedValue({ on: false, until: Date.now() + HOUR });
  serve([enFranja()]);
  await renderProvider();
  await waitFor(() => expect(repo.position).toHaveBeenCalled());
  expect(theme()).toHaveTextContent('normal');
  expect(screen.queryByTestId('night-mode-notice')).toBeNull();
  expect(announce).not.toHaveBeenCalled();
});

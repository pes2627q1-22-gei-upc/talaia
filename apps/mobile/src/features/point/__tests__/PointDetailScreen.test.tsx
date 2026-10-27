import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { apiGet, ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { PointDetailScreen } from '../PointDetailScreen';
import { asPointResponse, hour, point, respond } from '../__fixtures__/point';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
// El WebView no existeix a Jest; es comprova la pantalla nativa amb el repository real.
jest.mock('../PointLocationMap', () => () => null);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
const get = jest.mocked(apiGet);

async function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  return render(
    <QueryWrapper>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 0, left: 0, right: 0, bottom: 34 },
        }}
      >
        <PointDetailScreen pointId="montsec" />
      </SafeAreaProvider>
    </QueryWrapper>,
  );
}
beforeEach(async () => {
  get.mockReset();
  // Per defecte, com l'API: la fitxa o el desglossament segons la ruta.
  get.mockImplementation(respond());
  await i18n.changeLanguage('ca');
});

it('mostra les dades i les hores amb etiquetes accessibles', async () => {
  get.mockImplementation(respond());
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByText(point.descripcio)).toBeOnTheScreen();
  expect(screen.getByText(point.accessibilitat!)).toBeOnTheScreen();
  expect(screen.getByText('Vistes obertes')).toBeOnTheScreen();
  expect(screen.getByText('Cap al sud i al sud-oest')).toBeOnTheScreen();
  expect(screen.getByText('21,4 mag/arcsec² · Foscor de referència del lloc')).toBeOnTheScreen();
  expect(screen.getByText('Cel molt fosc · qualitat excel·lent')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Informació del punt' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Aquesta nit' })).toBeOnTheScreen();
  expect(screen.getByLabelText(/23:00.*87 de 100/)).toBeOnTheScreen();
  // Els factors de la millor hora de la nit; el Sol, ple, no surt.
  expect(screen.getByLabelText('Núvols. Cel ras')).toHaveAccessibilityValue({ now: 95 });
  expect(screen.getByLabelText('Lluna. La Lluna aclareix el cel')).toHaveAccessibilityValue({
    now: 68,
  });
  expect(screen.queryByText('Sol')).toBeNull();
});

it('triar una hora en mostra els factors, també una hora atenuada', async () => {
  get.mockImplementation(
    respond(point, [
      hour,
      {
        ...hour,
        hora: '2026-10-18T22:00:00Z',
        valor: 35,
        franja: 'tap',
        factors: { nuvols: 0.3, sol: 1, foscor: 0.94, lluna: 1 },
      },
      { ...hour, hora: '2026-10-18T23:00:00Z', valor: 94 },
    ]),
  );
  await renderScreen();
  const best = await screen.findByLabelText(/01:00.*94 de 100/);
  // Per defecte, la millor hora, amb el valor dins la barra.
  expect(best.props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByLabelText('Núvols. Cel ras')).toHaveAccessibilityValue({ now: 95 });
  expect(screen.getByText('Factors a les 01:00')).toBeOnTheScreen();

  const muted = screen.getByLabelText(/00:00.*35 de 100/);
  await fireEvent.press(muted);
  expect(muted.props.accessibilityState).toEqual({ selected: true });
  expect(best.props.accessibilityState).toEqual({ selected: false });
  expect(screen.getByText('Factors a les 00:00')).toBeOnTheScreen();
  expect(screen.getAllByText('35')).toHaveLength(1);
  expect(screen.getByLabelText('Núvols. Molt ennuvolat')).toHaveAccessibilityValue({ now: 30 });
  expect(screen.getByLabelText('Lluna. La Lluna no molesta')).toHaveAccessibilityValue({
    now: 100,
  });
});

it('manté totes les barres visibles quan no hi ha cap millor franja', async () => {
  get.mockImplementation(
    respond(
      point,
      point.properesHores.map((entry) => ({ ...entry, franja: 'tap' })),
    ),
  );
  await renderScreen();
  const bar = await screen.findByTestId('hour-bar-2026-10-18T21:00:00Z');
  expect(StyleSheet.flatten(bar.props.style).opacity).toBeUndefined();
});

it('el botó de reintent recupera la fitxa després d’un error', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  await renderScreen();
  const retry = await screen.findByRole('button', { name: 'Torna-ho a provar' });
  get.mockResolvedValue(asPointResponse());
  await fireEvent.press(retry);
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
});

it('explica el 404 sense oferir un reintent inútil', async () => {
  get.mockRejectedValue(new ApiError(404, 'not_found', 'Not found'));
  await renderScreen();
  expect(await screen.findByText('No hem trobat aquest punt')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
});

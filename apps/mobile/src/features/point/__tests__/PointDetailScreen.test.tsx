import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { apiGet, ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { PointDetailScreen } from '../PointDetailScreen';
import { asPointResponse, point } from '../__fixtures__/point';

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
  await i18n.changeLanguage('ca');
});

it('mostra les dades i les hores amb etiquetes accessibles', async () => {
  get.mockResolvedValue(asPointResponse());
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByText(point.descripcio)).toBeOnTheScreen();
  expect(screen.getByText(point.accessibilitat!)).toBeOnTheScreen();
  expect(screen.getByText('Vistes obertes')).toBeOnTheScreen();
  expect(screen.getByText('Cap al sud i al sud-oest')).toBeOnTheScreen();
  expect(screen.getByText('21,4 mag/arcsec² · Foscor de referència del lloc')).toBeOnTheScreen();
  expect(screen.getByText('Cel molt fosc · qualitat excel·lent')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Informació del punt' })).toBeOnTheScreen();
  expect(screen.getByText('Sol')).toBeOnTheScreen();
  expect(screen.getByLabelText(/23:00.*87 de 100/)).toBeOnTheScreen();
  expect(screen.getByText('94')).toBeOnTheScreen();
});

it('permet consultar també una hora atenuada i tornar a amagar-ne el valor', async () => {
  get.mockResolvedValue(asPointResponse());
  await renderScreen();
  const hour = await screen.findByLabelText(/23:00.*87 de 100/);
  expect(hour.props.accessibilityState).toEqual({ selected: false });
  expect(screen.getAllByText('87')).toHaveLength(1);
  expect(screen.queryByTestId('selected-hour-silhouette')).toBeNull();
  await fireEvent.press(hour);
  expect(hour.props.accessibilityState).toEqual({ selected: true });
  expect(screen.getAllByText('87')).toHaveLength(2);
  expect(screen.getByTestId('selected-hour-silhouette')).toBeOnTheScreen();
  await fireEvent.press(hour);
  expect(hour.props.accessibilityState).toEqual({ selected: false });
  expect(screen.getAllByText('87')).toHaveLength(1);
  expect(screen.queryByTestId('selected-hour-silhouette')).toBeNull();
});

it('manté totes les barres visibles quan no hi ha cap millor franja', async () => {
  get.mockResolvedValue(
    asPointResponse({
      ...point,
      properesHores: point.properesHores.map((entry) => ({ ...entry, franja: 'tap' })),
    }),
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

import type { Esdeveniment } from '@talaia/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiGet, ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { sizes } from '@/core/theme/tokens';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { EventDetailScreen } from '../EventDetailScreen';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
}));
const get = jest.mocked(apiGet);

const eclipsi: Esdeveniment = {
  id: 'eclipsi-lunar-penumbral-2027-02-20',
  tipus: 'eclipsi_llunar',
  nom: 'Eclipsi lunar penombral, visible sencer des de tot Catalunya i les Illes',
  inici: '2027-02-20T21:12:00Z',
  fi: '2027-02-21T01:13:00Z',
  maxim: '2027-02-20T23:13:00Z',
  descripcio:
    'La Lluna travessa la penombra de la Terra i s’enfosqueix lleugerament. Observable a ull nu des de qualsevol lloc amb l’horitzó est obert.',
  ubicacio: { nom: "Centre d'Observació de l'Univers", latitud: 41.95, longitud: 1.3 },
  font: 'NASA',
};

function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  return render(
    <QueryWrapper>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 54, left: 0, right: 0, bottom: 34 },
        }}
      >
        <EventDetailScreen eventId={eclipsi.id} />
      </SafeAreaProvider>
    </QueryWrapper>,
  );
}

beforeEach(async () => {
  get.mockReset();
  get.mockResolvedValue(eclipsi);
  await i18n.changeLanguage('ca');
});

it('mostra la fitxa: el nom, el tipus, la nit, l’horari i l’explicació', async () => {
  await renderScreen();
  expect(await screen.findByRole('header', { name: eclipsi.nom })).toBeOnTheScreen();
  expect(screen.getByText('Esdeveniment')).toBeOnTheScreen();
  expect(screen.getByText('Eclipsi lunar')).toBeOnTheScreen();
  expect(screen.getByText('Nit del 20 al 21 de febrer')).toBeOnTheScreen();
  expect(screen.getByText('Quan')).toBeOnTheScreen();
  expect(screen.getByText('De les 22:12 a les 02:13, amb el màxim a les 00:13.')).toBeOnTheScreen();
  expect(screen.getByText('Què veuràs')).toBeOnTheScreen();
  expect(screen.getByText(eclipsi.descripcio)).toBeOnTheScreen();
  expect(screen.getByRole('image', { name: 'Font: NASA' })).toBeOnTheScreen();
});

it('torna al calendari amb el botó enrere', async () => {
  await renderScreen();
  fireEvent.press(await screen.findByRole('button', { name: 'Torna al calendari' }));
  expect(router.back).toHaveBeenCalled();
});

// Tests de presentació (criteri de les tasques de frontend del Sprint 2): res de la fitxa queda
// tallat ni tapat, encara que el nom i l'explicació siguin llargs.
it('no talla cap text de la fitxa i les etiquetes passen a la línia següent si no hi caben', async () => {
  await renderScreen();
  await screen.findByRole('header', { name: eclipsi.nom });
  for (const text of [eclipsi.nom, eclipsi.descripcio, 'Nit del 20 al 21 de febrer']) {
    expect(screen.getByText(text).props.numberOfLines).toBeUndefined();
  }
  expect(StyleSheet.flatten(screen.getByTestId('event-tags').props.style)).toMatchObject({
    flexWrap: 'wrap',
  });
});

it('el botó enrere té la mida mínima de tacte i el títol de la capçalera queda centrat', async () => {
  await renderScreen();
  const back = await screen.findByRole('button', { name: 'Torna al calendari' });
  expect(StyleSheet.flatten(back.props.style)).toMatchObject({
    width: sizes.touch,
    height: sizes.touch,
  });
  expect(StyleSheet.flatten(screen.getByText('Esdeveniment').props.style)).toMatchObject({
    flex: 1,
    textAlign: 'center',
  });
});

it('avisa si l’esdeveniment no existeix i deixa tornar-ho a provar si falla la xarxa', async () => {
  get.mockReset();
  get.mockRejectedValueOnce(new ApiError(404, 'not_found', 'No existeix'));
  const first = await renderScreen();
  expect(await screen.findByText('No hem trobat aquest esdeveniment')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
  first.unmount();

  get.mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'Caigut'));
  get.mockResolvedValueOnce(eclipsi);
  await renderScreen();
  fireEvent.press(await screen.findByRole('button', { name: 'Torna-ho a provar' }));
  expect(await screen.findByRole('header', { name: eclipsi.nom })).toBeOnTheScreen();
});

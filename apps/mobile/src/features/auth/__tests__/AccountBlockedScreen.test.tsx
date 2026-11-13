import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';

import { AccountBlockedScreen } from '../AccountBlockedScreen';
import { profileRepository } from '../profileRepository';
import { useAuthViewModel } from '../useAuthViewModel';

jest.mock('../useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));
jest.mock('../profileRepository', () => ({ profileRepository: { ensure: jest.fn() } }));
// El correu real és al .env de cadascú: els tests no en depenen.
const mockEnv = { contactEmail: null as string | null };
jest.mock('@/core/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

const signOut = jest.fn(async () => {});

function auth(overrides: Partial<ReturnType<typeof useAuthViewModel>> = {}) {
  jest.mocked(useAuthViewModel).mockReturnValue({
    error: null,
    signingOut: false,
    logoutLabel: i18n.t('auth.signOut'),
    signOut,
    ...overrides,
  } as unknown as ReturnType<typeof useAuthViewModel>);
}

async function renderScreen() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 20, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AccountBlockedScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockEnv.contactEmail = null;
  await i18n.changeLanguage('ca');
  auth();
});

it('explica que el compte està bloquejat i permet tancar la sessió', async () => {
  await renderScreen();
  expect(screen.getByRole('header', { name: 'El teu compte està bloquejat' })).toBeOnTheScreen();
  expect(screen.getByText(/contacta amb l'equip de Talaia/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Tanca la sessió' }));
  expect(signOut).toHaveBeenCalledTimes(1);
});

it.each(['ca', 'es', 'en'])(
  'en %s, el text i els botons van en blocs separats i el text no es talla',
  async (language) => {
    mockEnv.contactEmail = 'equip@example.test';
    await i18n.changeLanguage(language);
    auth({ logoutLabel: i18n.t('auth.signOut') });
    await renderScreen();
    const title = screen.getByRole('header');
    const message = screen.getByText(i18n.t('accountBlocked.message'));
    const button = screen.getByRole('button', { name: i18n.t('auth.signOut') });
    // El text ocupa l'espai que queda (flex 1) i el botó va a sota, fora d'aquest bloc: no s'hi
    // pot posar a sobre, ni en una pantalla petita (320 × 568) ni amb el text més llarg.
    const content = screen.getByTestId('account-blocked-text');
    expect(content).toHaveStyle({ flex: 1 });
    expect(within(content).queryByRole('button', { name: i18n.t('auth.signOut') })).toBeNull();
    expect(within(content).getByRole('header')).toBe(title);
    expect(within(content).getByText(i18n.t('accountBlocked.message'))).toBe(message);
    expect(button).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: i18n.t('accountBlocked.retry') })).toBeOnTheScreen();
    expect(title.props.numberOfLines).toBeUndefined();
    expect(message.props.numberOfLines).toBeUndefined();
  },
);

it('mentre tanca la sessió, el botó no es pot tornar a prémer', async () => {
  auth({ signingOut: true, logoutLabel: 'Tancant la sessió…' });
  await renderScreen();
  expect(screen.getByRole('button', { name: 'Tancant la sessió…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Torna-ho a comprovar' })).toBeDisabled();
});

it('si no ha pogut tancar la sessió, ho diu', async () => {
  auth({ error: 'logout' });
  await renderScreen();
  expect(screen.getByText("No s'ha pogut tancar la sessió. Torna-ho a provar.")).toBeOnTheScreen();
});

it('amb el correu de l’equip configurat, ofereix escriure-hi', async () => {
  mockEnv.contactEmail = 'equip@example.test';
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Escriu a equip@example.test' }));
  expect(openURL).toHaveBeenCalledWith('mailto:equip@example.test');
});

it('sense el correu configurat, no hi ha cap botó per escriure', async () => {
  await renderScreen();
  expect(screen.queryByRole('button', { name: /Escriu a/ })).toBeNull();
});

it('«Torna-ho a comprovar» torna a preguntar a l’API i, mentrestant, no es pot tornar a prémer', async () => {
  let finish!: () => void;
  jest.mocked(profileRepository.ensure).mockReturnValue(
    new Promise((done) => {
      finish = () => done({ created: false });
    }),
  );
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a comprovar' }));
  expect(profileRepository.ensure).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Comprovant…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Tanca la sessió' })).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Torna-ho a comprovar' })).toBeEnabled();
});

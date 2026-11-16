import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { accountBlocked } from '@/core/api/accountBlocked';
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
    user: { id: 'one', email: 'one@example.test' },
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
  const contact = screen.getByRole('button', { name: 'Escriu a equip@example.test' });
  // Centrat com la resta del text de l'avís.
  expect(contact).toHaveStyle({ alignSelf: 'center' });
  await fireEvent.press(contact);
  expect(openURL).toHaveBeenCalledWith(
    'mailto:equip@example.test?subject=Compte%20de%20Talaia%20bloquejat&body=El%20meu%20compte%20de%20Talaia%20%C3%A9s%20one%40example.test.',
  );
});

it('sense el correu configurat, no hi ha cap botó per escriure', async () => {
  await renderScreen();
  expect(screen.queryByRole('button', { name: /Escriu a/ })).toBeNull();
});

it('si no es pot obrir el correu, avisa sota el botó', async () => {
  mockEnv.contactEmail = 'equip@example.test';
  jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('no mail app'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Escriu a equip@example.test' }));
  const alert = await screen.findByRole('alert');
  // L'adreça es pot seleccionar i copiar.
  expect(alert.props.selectable).toBe(true);
  expect(alert).toHaveTextContent(
    "No s'ha pogut obrir el correu. Escriu-nos a equip@example.test.",
  );
});

it('reconsulta el bloqueig des del botó i impedeix repetir accions mentre comprova', async () => {
  let finish!: () => void;
  jest.mocked(profileRepository.ensure).mockReturnValue(
    new Promise((resolve) => {
      finish = () => resolve({ created: false });
    }),
  );
  accountBlocked.report();
  try {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a comprovar' }));
    const checking = screen.getByRole('button', { name: 'Comprovant…' });
    const logout = screen.getByRole('button', { name: 'Tanca la sessió' });
    expect(checking).toBeDisabled();
    expect(logout).toBeDisabled();
    await fireEvent.press(checking);
    await fireEvent.press(logout);
    expect(profileRepository.ensure).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(accountBlocked.get()).toBe(false);
    expect(screen.getByRole('button', { name: 'Torna-ho a comprovar' })).toBeEnabled();
  } finally {
    accountBlocked.clear();
  }
});

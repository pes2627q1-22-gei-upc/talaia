import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';

import { EmailLinkScreen } from '../EmailLinkScreen';
import { signInAndEnsureProfile } from '../signIn';

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('../signIn', () => ({ signInAndEnsureProfile: jest.fn() }));

const replace = jest.fn();

function renderLink() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <EmailLinkScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('ca');
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
});

it('mostra la càrrega mentre comprova l’enllaç i la substitueix pel motiu de l’error', async () => {
  let finish!: (result: Awaited<ReturnType<typeof signInAndEnsureProfile>>) => void;
  jest.mocked(useLocalSearchParams).mockReturnValue({ code: 'pkce-code' });
  jest.mocked(signInAndEnsureProfile).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await renderLink();
  expect(screen.getByRole('header', { name: 'Entrant…' })).toBeOnTheScreen();
  expect(screen.getByText("Un moment: estem comprovant l'enllaç del correu.")).toBeOnTheScreen();
  expect(screen.getByTestId('email-link-loading')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();

  await act(async () => finish({ ok: false, reason: 'invalidLink' }));
  expect(screen.getByRole('header', { name: 'No hem pogut entrar' })).toBeOnTheScreen();
  expect(screen.getByText(/Obre'l al mateix mòbil/)).toBeOnTheScreen();
  expect(screen.queryByTestId('email-link-loading')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: "Torna a l'inici" }));
  expect(replace).toHaveBeenCalledWith('/benvinguda');
});

it('un enllaç caducat explica l’error directament i ofereix tornar a començar', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ error_code: 'otp_expired' });
  await renderLink();
  expect(screen.getByText('El codi no és correcte o ha caducat.')).toBeOnTheScreen();
  expect(screen.queryByTestId('email-link-loading')).toBeNull();
  expect(signInAndEnsureProfile).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: "Torna a l'inici" }));
  expect(replace).toHaveBeenCalledWith('/benvinguda');
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';

import { authRepository, SignInFailure } from '../authRepository';
import { EmailLoginScreen } from '../EmailLoginScreen';
import { signInAndEnsureProfile } from '../signIn';
import { RESEND_AFTER_S } from '../useEmailLoginViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../signIn', () => ({ signInAndEnsureProfile: jest.fn() }));
jest.mock('../authRepository', () => ({
  ...jest.requireActual('../authRepository'),
  authRepository: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
}));

const replace = jest.fn();
const dismissAll = jest.fn();

function renderLogin() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <EmailLoginScreen />
    </SafeAreaProvider>,
  );
}

async function enterEmail() {
  await fireEvent.changeText(screen.getByLabelText('Correu electrònic'), 'nom@exemple.cat');
}

async function sendCode() {
  await enterEmail();
  await fireEvent.press(screen.getByRole('button', { name: 'Envia el codi' }));
  await screen.findByRole('header', { name: 'Escriu el codi' });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('ca');
  jest
    .mocked(useRouter)
    .mockReturnValue({ replace, dismissAll } as unknown as ReturnType<typeof useRouter>);
  jest.mocked(authRepository.sendEmailCode).mockResolvedValue();
  jest.mocked(signInAndEnsureProfile).mockImplementation(async (signIn) => {
    await signIn();
    return { ok: true };
  });
});

afterEach(() => jest.useRealTimers());

it('valida el correu escrit al camp abans de permetre enviar el codi', async () => {
  await renderLogin();
  expect(screen.getByRole('header', { name: 'Entra amb el correu' })).toBeOnTheScreen();
  const submit = screen.getByRole('button', { name: 'Envia el codi' });
  expect(submit).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Correu electrònic'), 'nom@');
  expect(submit).toBeDisabled();
  await fireEvent.press(submit);
  expect(authRepository.sendEmailCode).not.toHaveBeenCalled();
  await sendCode();
  expect(authRepository.sendEmailCode).toHaveBeenCalledWith('nom@exemple.cat');
  expect(
    screen.getByText("L'hem enviat a nom@exemple.cat. Mira també el correu brossa."),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText('Correu electrònic')).toBeNull();
  expect(screen.getByRole('button', { name: 'Entra' })).toBeDisabled();
});

it('el teclat també permet enviar un correu vàlid, sense duplicar l’enviament pendent', async () => {
  let finish!: () => void;
  jest.mocked(authRepository.sendEmailCode).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await renderLogin();
  const input = screen.getByLabelText('Correu electrònic');
  await fireEvent(input, 'submitEditing');
  expect(authRepository.sendEmailCode).not.toHaveBeenCalled();
  await enterEmail();
  await fireEvent(input, 'submitEditing');
  expect(screen.getByRole('button', { name: 'Enviant…' })).toBeDisabled();
  expect(input).toHaveProp('editable', false);
  await fireEvent(input, 'submitEditing');
  expect(authRepository.sendEmailCode).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByLabelText('Codi de 6 xifres')).toBeOnTheScreen();
});

it('anuncia l’error d’enviament al costat del camp i el neteja en editar', async () => {
  jest.mocked(authRepository.sendEmailCode).mockRejectedValue(new SignInFailure('rateLimited'));
  await renderLogin();
  await enterEmail();
  await fireEvent.press(screen.getByRole('button', { name: 'Envia el codi' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Massa intents seguits. Espera un moment i torna-ho a provar.',
  );
  expect(screen.getByRole('header', { name: 'Entra amb el correu' })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Correu electrònic'), 'altre@exemple.cat');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('comprova automàticament les sis xifres del camp i navega a l’app', async () => {
  await renderLogin();
  await sendCode();
  const code = screen.getByLabelText('Codi de 6 xifres');
  await fireEvent.changeText(code, '12345');
  expect(screen.getByRole('button', { name: 'Entra' })).toBeDisabled();
  expect(signInAndEnsureProfile).not.toHaveBeenCalled();
  await fireEvent.changeText(code, '123456');
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  expect(authRepository.verifyEmailCode).toHaveBeenCalledWith('nom@exemple.cat', '123456');
  expect(dismissAll).toHaveBeenCalledTimes(1);
});

it('bloqueja el camp i el botó durant la verificació i mostra el codi incorrecte', async () => {
  let finish!: (result: Awaited<ReturnType<typeof signInAndEnsureProfile>>) => void;
  jest.mocked(signInAndEnsureProfile).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await renderLogin();
  await sendCode();
  await fireEvent.changeText(screen.getByLabelText('Codi de 6 xifres'), '000000');
  expect(screen.getByRole('button', { name: 'Comprovant…' })).toBeDisabled();
  expect(screen.getByLabelText('Codi de 6 xifres')).toHaveProp('editable', false);
  await fireEvent.press(screen.getByRole('button', { name: 'Comprovant…' }));
  expect(signInAndEnsureProfile).toHaveBeenCalledTimes(1);
  await act(async () => finish({ ok: false, reason: 'invalidCode' }));
  expect(screen.getByRole('alert')).toHaveTextContent('El codi no és correcte o ha caducat.');
  expect(screen.getByLabelText('Codi de 6 xifres')).toHaveDisplayValue('');
  expect(screen.getByRole('button', { name: 'Entra' })).toBeDisabled();
  expect(replace).not.toHaveBeenCalled();
});

it('habilita el reenviament passat el termini i anuncia que hi ha un codi nou', async () => {
  jest.useFakeTimers();
  await renderLogin();
  await sendCode();
  const resend = screen.getByRole('button', {
    name: `Torna a enviar el codi (${RESEND_AFTER_S} s)`,
  });
  expect(resend).toBeDisabled();
  await fireEvent.press(resend);
  expect(authRepository.sendEmailCode).toHaveBeenCalledTimes(1);
  for (let seconds = 0; seconds < RESEND_AFTER_S; seconds++) {
    await act(() => jest.advanceTimersByTime(1000));
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Torna a enviar el codi' }));
  expect(authRepository.sendEmailCode).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent("T'hem enviat un codi nou.");
  expect(
    screen.getByRole('button', { name: `Torna a enviar el codi (${RESEND_AFTER_S} s)` }),
  ).toBeDisabled();
});

it('permet reintentar la verificació amb el botó Entra després d’un error de xarxa', async () => {
  jest.mocked(signInAndEnsureProfile).mockResolvedValueOnce({ ok: false, reason: 'network' });
  await renderLogin();
  await sendCode();
  await fireEvent.changeText(screen.getByLabelText('Codi de 6 xifres'), '123456');
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  expect(screen.getByLabelText('Codi de 6 xifres')).toHaveDisplayValue('123456');
  expect(screen.getByRole('button', { name: 'Entra' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Entra' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  expect(signInAndEnsureProfile).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('permet canviar l’adreça des del pas del codi i conserva el correu escrit', async () => {
  await renderLogin();
  await sendCode();
  await fireEvent.press(screen.getByRole('button', { name: "Canvia l'adreça" }));
  expect(screen.getByLabelText('Correu electrònic')).toHaveDisplayValue('nom@exemple.cat');
  expect(screen.queryByLabelText('Codi de 6 xifres')).toBeNull();
  expect(screen.queryByRole('button', { name: /Torna a enviar el codi/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Envia el codi' })).toBeEnabled();
});

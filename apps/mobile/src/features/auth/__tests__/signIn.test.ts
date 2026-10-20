import { apiPost } from '@/core/api/httpClient';

import { authRepository, SignInFailure } from '../authRepository';
import { profileRepository } from '../profileRepository';
import { signInAndEnsureProfile } from '../signIn';

jest.mock('@/core/api/httpClient', () => ({ apiPost: jest.fn() }));
jest.mock('../authRepository', () => ({
  ...jest.requireActual('../authRepository'),
  authRepository: { signOut: jest.fn(async () => {}) },
}));

beforeEach(() => jest.clearAllMocks());

it('el perfil es demana a POST /perfil (TG-84)', async () => {
  jest.mocked(apiPost).mockResolvedValue({ created: true, profile: { id: 'p' } });
  expect(await profileRepository.ensure()).toEqual({ created: true });
  expect(apiPost).toHaveBeenCalledWith('/perfil', undefined);
});

it("envia al perfil el nom que només té l'app (Apple)", async () => {
  jest.mocked(apiPost).mockResolvedValue({ created: true });
  expect(await signInAndEnsureProfile(async () => ({ nom: 'Martina Maldonado' }))).toEqual({
    ok: true,
  });
  expect(apiPost).toHaveBeenCalledWith('/perfil', { nom: 'Martina Maldonado' });
});

it('després d’iniciar sessió assegura el perfil', async () => {
  jest.mocked(apiPost).mockResolvedValue({ created: false });
  const signIn = jest.fn(async () => {});
  expect(await signInAndEnsureProfile(signIn)).toEqual({ ok: true });
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(apiPost).toHaveBeenCalledWith('/perfil', undefined);
});

it('si l’inici de sessió falla, no toca el perfil i en dona el motiu', async () => {
  const result = await signInAndEnsureProfile(async () => {
    throw new SignInFailure('cancelled');
  });
  expect(result).toEqual({ ok: false, reason: 'cancelled' });
  expect(apiPost).not.toHaveBeenCalled();

  expect(
    await signInAndEnsureProfile(async () => {
      throw new Error('?');
    }),
  ).toEqual({ ok: false, reason: 'unknown' });
});

it('si el perfil falla, tanca la sessió perquè no quedi a mitges', async () => {
  jest.mocked(apiPost).mockRejectedValue(new Error('503'));
  expect(await signInAndEnsureProfile(async () => {})).toEqual({ ok: false, reason: 'profile' });
  expect(authRepository.signOut).toHaveBeenCalledTimes(1);
});

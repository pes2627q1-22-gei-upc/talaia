import { redirectSystemPath } from '@/app/+native-intent';

it("deixa la tornada de Google a la benvinguda i obre la ruta de l'enllaç del correu", () => {
  expect(redirectSystemPath({ path: '/--/auth/callback?code=abc', initial: false })).toBe(
    '/benvinguda',
  );
  expect(redirectSystemPath({ path: '/--/auth/correu?code=abc', initial: true })).toBe(
    '/--/auth/correu?code=abc',
  );
});

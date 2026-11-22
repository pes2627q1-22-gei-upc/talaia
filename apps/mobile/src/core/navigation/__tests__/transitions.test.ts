import { rootStackOptions, stackOptions, statusBarPerScreen } from '../transitions';

describe('stackOptions', () => {
  it("fa servir el lliscament d'iOS també a Android i el gest de tornar des de tota la pantalla", () => {
    expect(stackOptions.animation).toBe('ios_from_right');
    expect(stackOptions.fullScreenGestureEnabled).toBe(true);
    expect(stackOptions.headerShown).toBe(false);
  });
});

describe('barra d’estat', () => {
  it('va per pantalla només a iOS fora d’Expo Go', () => {
    expect(statusBarPerScreen('ios', false)).toBe(true);
    expect(statusBarPerScreen('ios', true)).toBe(false);
    expect(statusBarPerScreen('android', false)).toBe(false);
  });

  it('per pantalla, és clara i en mode nit s’amaga', () => {
    expect(rootStackOptions(false, true)).toMatchObject({
      statusBarStyle: 'light',
      statusBarHidden: false,
    });
    expect(rootStackOptions(true, true)).toMatchObject({ statusBarHidden: true });
  });

  it('a Expo Go i a Android, el Stack no en diu res: hi peta, i la porta <StatusBar>', () => {
    expect(rootStackOptions(true, false)).toBe(stackOptions);
  });
});

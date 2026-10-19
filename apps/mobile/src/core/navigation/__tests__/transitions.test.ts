import { stackOptions } from '../transitions';

describe('stackOptions', () => {
  it("fa servir el lliscament d'iOS també a Android i el gest de tornar des de tota la pantalla", () => {
    expect(stackOptions.animation).toBe('ios_from_right');
    expect(stackOptions.fullScreenGestureEnabled).toBe(true);
    expect(stackOptions.headerShown).toBe(false);
  });
});

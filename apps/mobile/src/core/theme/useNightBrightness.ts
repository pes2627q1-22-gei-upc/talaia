import * as Brightness from 'expo-brightness';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

// ponytail: valor fix (ADR-0032); si al dispositiu és massa fosc o massa clar, és aquí.
export const NIGHT_BRIGHTNESS = 0.1;

type Saved = { value: number; followsSystem: boolean };

// Una sola fila per a tota l'app, i no una per activació: si el mode s'activa, es desactiva i es
// torna a activar amb una lectura pendent, la restauració de la primera vegada no pot passar per
// davant de la baixada nova.
let queue = Promise.resolve();
const run = (step: () => Promise<void>) => {
  queue = queue.then(step).catch(() => undefined);
};

/**
 * Mentre `active`, baixa la brillantor de la pantalla i torna la d'abans en sortir del mode o quan
 * l'app passa a segon pla. A iOS la brillantor és de tota la pantalla i no es desfà sola en sortir.
 * A Android és la de l'activitat: si seguia la del sistema, en sortir s'hi torna, perquè un valor fix
 * faria que l'app deixés de seguir els canvis del sistema.
 * Només es baixa en entrar al mode o en tornar a primer pla: si l'usuari la puja des del Centre de
 * control (l'app només passa a `inactive`), no se li torna a baixar.
 */
export function useNightBrightness(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let saved: Saved | null = null;
    const lower = () =>
      run(async () => {
        if (saved) return;
        const followsSystem =
          Platform.OS === 'android' && (await Brightness.isUsingSystemBrightnessAsync());
        saved = { value: await Brightness.getBrightnessAsync(), followsSystem };
        await Brightness.setBrightnessAsync(NIGHT_BRIGHTNESS);
      });
    const restore = () =>
      run(async () => {
        if (!saved) return;
        const previous = saved;
        saved = null;
        if (previous.followsSystem) await Brightness.restoreSystemBrightnessAsync();
        else await Brightness.setBrightnessAsync(previous.value);
      });

    lower();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') restore();
      else if (state === 'active') lower();
    });
    return () => {
      subscription.remove();
      restore();
    };
  }, [active]);
}

import * as Brightness from 'expo-brightness';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// ponytail: valor fix (ADR-0032); si al dispositiu és massa fosc o massa clar, és aquí.
export const NIGHT_BRIGHTNESS = 0.1;

/**
 * Mentre `active`, baixa la brillantor de la pantalla i torna la d'abans en sortir del mode o quan
 * l'app passa a segon pla. A iOS la brillantor és de tota la pantalla i no es desfà sola en sortir.
 * Només es baixa en entrar al mode o en tornar a primer pla: si l'usuari la puja des del Centre de
 * control (l'app només passa a `inactive`), no se li torna a baixar.
 */
export function useNightBrightness(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let saved: number | null = null;
    // Les crides van en fila: una restauració no pot passar per davant d'una baixada a mig fer.
    let queue = Promise.resolve();
    const run = (step: () => Promise<void>) => {
      queue = queue.then(step).catch(() => undefined);
    };
    const lower = () =>
      run(async () => {
        if (saved !== null) return;
        saved = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(NIGHT_BRIGHTNESS);
      });
    const restore = () =>
      run(async () => {
        if (saved === null) return;
        const previous = saved;
        saved = null;
        await Brightness.setBrightnessAsync(previous);
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

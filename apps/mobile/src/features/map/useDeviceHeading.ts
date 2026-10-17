import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { watchDeviceHeading } from './headingRepository';

/** Atura el sensor en sortir del mapa o posar l'app en segon pla. */
export function useDeviceHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let generation = 0;
      let subscription: { remove(): void } | undefined;
      const stop = () => {
        generation++;
        subscription?.remove();
        subscription = undefined;
        setHeading(null);
        setActive(false);
      };
      const start = () => {
        stop();
        if (!enabled) return;
        setActive(true);
        const current = generation;
        let last: number | null = null;
        let lastTime = 0;
        void watchDeviceHeading((value) => {
          if (current !== generation) return;
          const now = Date.now();
          const delta =
            last === null || value === null ? 180 : Math.abs(((value - last + 540) % 360) - 180);
          if (value !== null && last !== null && (delta < 2 || now - lastTime < 100)) return;
          last = value;
          lastTime = now;
          setHeading(value);
        })
          .then((watcher) => {
            if (current !== generation) watcher.remove();
            else subscription = watcher;
          })
          .catch(() => {
            if (current === generation) setHeading(null);
          });
      };
      if (AppState.currentState === 'active') start();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') start();
        else stop();
      });
      return () => {
        stop();
        listener.remove();
      };
    }, [enabled]),
  );
  return { heading: enabled ? heading : null, active };
}

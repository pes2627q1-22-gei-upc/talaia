import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { pushRepository } from './pushRepository';

/**
 * En tocar una notificació d'una alerta, obre la fitxa del punt (HU17, TG-154), com el mapa i les
 * recomanacions. Només quan `enabled`: l'app espera que la sessió s'hagi resolt i no s'obre res
 * sense sessió ni amb el compte bloquejat (ADR-0028). La notificació que ha obert l'app en fred
 * espera fins llavors.
 */
export function useOpenNotifiedPoint(enabled: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return undefined;
    return pushRepository.onPointNotificationOpened((id) =>
      router.push({ pathname: '/punt/[id]', params: { id } }),
    );
  }, [enabled, router]);
}

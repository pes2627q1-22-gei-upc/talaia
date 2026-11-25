import type { Pla } from '@talaia/shared';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, AppState } from 'react-native';

import { ThemeProvider } from '@/core/theme/theme';
import { useAuthState } from '@/features/auth/AuthProvider';
import { useMapPointsQuery } from '@/features/map/mapRepository';
import { usePlansQuery } from '@/features/plans/plansRepository';

import { NightModeNotice } from './NightModeNotice';
import {
  type ManualChoice,
  nextNightEnd,
  nightTheme,
  planNearby,
  plansInWindow,
} from './nightModeModel';
import { nightModeRepository } from './nightModeRepository';

/** El rellotge del mode: una tria a mà caduca i les franges comencen i acaben. */
const TICK_MS = 60 * 1000;
/** Durant la franja d'un pla, cada quant es torna a mirar on és l'usuari. */
export const CHECK_EVERY_MS = 5 * 60 * 1000;

type NightMode = { on: boolean; setOn: (on: boolean) => void };

const NightModeContext = createContext<NightMode>({ on: false, setOn: () => undefined });

export const useNightMode = () => useContext(NightModeContext);

/**
 * Decideix el tema de l'app (HU45, TG-240; ADR-0032) i el dona al `ThemeProvider`:
 * - una tria a mà (l'interruptor del perfil) mana fins a les 06:00 següents;
 * - si no n'hi ha, s'activa sol mentre l'usuari és a menys de 500 m del punt d'un pla seu durant la
 *   franja del pla, i ho avisa.
 *
 * La ubicació només es mira durant la franja d'un pla, en primer pla i si ja hi ha el permís.
 */
export function NightModeProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const { user } = useAuthState();
  const [choice, setChoice] = useState<ManualChoice | null>(null);
  const [now, setNow] = useState(Date.now);
  const [foreground, setForeground] = useState(0);
  const [nearby, setNearby] = useState<Pla | null>(null);
  const [notice, setNotice] = useState<Pla | null>(null);
  // La tria i el pla ja avisat, per a la resposta de la ubicació (fora del render).
  const choiceRef = useRef<ManualChoice | null>(null);
  const announced = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void nightModeRepository.load().then((saved) => {
      // Si l'usuari ja ha tocat l'interruptor mentre es llegia, la seva tria és la bona.
      if (!alive || choiceRef.current) return;
      choiceRef.current = saved;
      setChoice(saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, TICK_MS);
    };
    timer = setTimeout(tick, TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(Date.now());
      setForeground((count) => count + 1);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const plans = usePlansQuery('futurs', user !== null);
  const planList = user ? plans.data : undefined;
  const windowKey = useMemo(
    () =>
      plansInWindow(planList ?? [], now)
        .map((plan) => plan.id)
        .join(),
    [planList, now],
  );
  const points = useMapPointsQuery(windowKey !== '');
  const slot = Math.floor(now / CHECK_EVERY_MS);

  useEffect(() => {
    const features = points.data?.features;
    // Només en primer pla: un tic del rellotge just en passar a segon pla no ha de mirar on és.
    if (windowKey === '' || !features || AppState.currentState !== 'active') return;
    let alive = true;
    nightModeRepository
      .position()
      .then((position) => {
        if (!alive) return;
        const at = Date.now();
        const plan = (position && planNearby(planList ?? [], features, position, at)) || null;
        setNearby(plan);
        // Avisa només en entrar a la zona d'un pla, no a cada comprovació, i no si mana una tria.
        const choice = choiceRef.current;
        if (plan && plan.id !== announced.current && !(choice && choice.until > at)) {
          setNotice(plan);
          AccessibilityInfo.announceForAccessibility(
            t('nightMode.notice', { point: plan.punt.nom }),
          );
        }
        announced.current = plan?.id ?? null;
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [windowKey, planList, points.data, slot, foreground, t]);

  // L'última posició compta mentre el pla continuï en franja (i existeixi): en acabar-se, s'apaga.
  const inZone =
    nearby !== null && plansInWindow(planList ?? [], now).some((plan) => plan.id === nearby.id);
  const name = nightTheme(choice, inZone, now);

  const setOn = useCallback((on: boolean) => {
    const next = { on, until: nextNightEnd(new Date()).getTime() };
    choiceRef.current = next;
    setChoice(next);
    setNotice(null);
    void nightModeRepository.save(next);
  }, []);

  const value = useMemo(() => ({ on: name === 'vermell', setOn }), [name, setOn]);
  const dismiss = useCallback(() => setNotice(null), []);

  return (
    <NightModeContext.Provider value={value}>
      <ThemeProvider name={name}>
        {children}
        {notice ? (
          <NightModeNotice
            message={t('nightMode.notice', { point: notice.punt.nom })}
            actionLabel={t('nightMode.turnOff')}
            onAction={() => setOn(false)}
            onDismiss={dismiss}
          />
        ) : null}
      </ThemeProvider>
    </NightModeContext.Provider>
  );
}

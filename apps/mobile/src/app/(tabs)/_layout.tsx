import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { colors } from '@/core/theme/tokens';
import { RestoreErrorScreen } from '@/features/auth/RestoreErrorScreen';
import { useSessionGate } from '@/features/auth/useSessionGate';

// SF Symbols a iOS i Material Symbols a Android (expo-symbols, que Expo Go porta).
// La barra pròpia del mockup (icones de Talaia) queda per a una tasca a part.

export default function TabsLayout() {
  const { t } = useTranslation();
  const gate = useSessionGate();

  // Sense sessió no s'entra a l'app: la benvinguda és la porta (HU35). Mentre es restaura, res.
  if (gate === 'restoring') return null;
  if (gate === 'restoreFailed') return <RestoreErrorScreen />;
  if (gate === 'signedOut') return <Redirect href="/benvinguda" />;

  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.crep}
      tintColor={colors.far}
      labelStyle={{ default: { color: colors.boira }, selected: { color: colors.far } }}
    >
      <NativeTabs.Trigger name="(explora)">
        <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="safari" md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendari">
        <NativeTabs.Trigger.Label>{t('tabs.calendar')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alertes">
        <NativeTabs.Trigger.Label>{t('tabs.alerts')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell" md="notifications" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

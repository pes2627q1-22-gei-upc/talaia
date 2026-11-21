import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/core/navigation/TabBar';
import { AccountBlockedScreen } from '@/features/auth/AccountBlockedScreen';
import { RestoreErrorScreen } from '@/features/auth/RestoreErrorScreen';
import { useSessionGate } from '@/features/auth/useSessionGate';
import { useOpenNotifiedPoint } from '@/features/notifications/useOpenNotifiedPoint';

// Barra pròpia (`TabBar`, ADR-0037): la nativa d'iOS 26 no es pot posar en vermell en mode nit.
const renderTabBar = (props: Parameters<typeof TabBar>[0]) => <TabBar {...props} />;

export default function TabsLayout() {
  const { t } = useTranslation();
  const gate = useSessionGate();
  // En tocar una notificació d'una alerta, la fitxa del punt: només amb sessió (TG-154).
  useOpenNotifiedPoint(gate === 'signedIn');

  // Sense sessió no s'entra a l'app: la benvinguda és la porta (HU35). Mentre es restaura, res.
  if (gate === 'restoring') return null;
  if (gate === 'restoreFailed') return <RestoreErrorScreen />;
  if (gate === 'blocked') return <AccountBlockedScreen />;
  if (gate === 'signedOut') return <Redirect href="/benvinguda" />;

  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(explora)" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="calendari" options={{ title: t('tabs.calendar') }} />
      <Tabs.Screen name="(alertes)" options={{ title: t('tabs.alerts') }} />
      <Tabs.Screen name="perfil" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}

import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/core/api/queryClient';
import { languageReady } from '@/core/i18n';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { PushRegistrationProvider } from '@/features/notifications/PushRegistrationProvider';

/** Tots els proveïdors globals de l'app, en un sol lloc. */
export function AppProviders({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const finishLoading = () => {
      if (mounted) setReady(true);
    };
    // Un error d’inicialització de l’idioma no ha de bloquejar tota l’app.
    void languageReady.then(finishLoading, finishLoading);
    return () => {
      mounted = false;
    };
  }, []);
  // Cap consulta abans d’acabar l’intent de recuperar la preferència desada.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PushRegistrationProvider>{children}</PushRegistrationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

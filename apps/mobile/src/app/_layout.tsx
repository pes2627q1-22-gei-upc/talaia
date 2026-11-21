import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  AtkinsonHyperlegibleNext_800ExtraBold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LogBox } from 'react-native';

import { AppProviders } from '@/core/providers/AppProviders';
import { rootStackOptions, statusBarPerScreen } from '@/core/navigation/transitions';
import { useTheme } from '@/core/theme/theme';
import { EmailLoginCloseButton } from '@/features/auth/EmailLoginCloseButton';

void SplashScreen.preventAutoHideAsync();

// Expo (SDK 58) no captura la promesa d'`injectJavaScript` quan reenvia les props a una DOM component
// que ja s'està desmuntant (expo/expo#50679): surt en tancar la fitxa o canviar de pestanya amb el mapa
// actualitzant-se. No es perd res, perquè cada enviament porta totes les props, i en producció React
// Native no segueix les promeses. Treure-ho quan Expo la capturi a `webview-wrapper.tsx`.
LogBox.ignoreLogs(["Unable to find the 'DomWebView' view"]);

function RootStack() {
  const { t } = useTranslation();
  const { name, colors } = useTheme();
  return (
    <Stack screenOptions={rootStackOptions(name === 'vermell')}>
      {/* Des de la benvinguda, l'app entra amb una fosa (la benvinguda ja ha fet la seva sortida). */}
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      {/* `punt/[id]`, `pla/nou` i `plans` porten el seu botó enrere: el natiu d'iOS 26 és de vidre (ADR-0032). */}
      <Stack.Screen
        name="benvinguda"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="benvinguda-correu"
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: t('emailLogin.back'),
          headerTransparent: true,
          headerTintColor: colors.lluna,
          headerLeft: () => <EmailLoginCloseButton />,
        }}
      />
    </Stack>
  );
}

function ThemedApp() {
  const { name, colors } = useTheme();
  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: colors.nit,
        card: colors.card,
        text: colors.lluna,
        border: colors.linia,
        primary: colors.far,
      },
    }),
    [colors],
  );
  return (
    <NavigationThemeProvider value={navigationTheme}>
      {/* A iOS fora d'Expo Go la barra va per pantalla (`rootStackOptions`). */}
      {!statusBarPerScreen() && <StatusBar style="light" hidden={name === 'vermell'} />}
      <RootStack />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  // Les claus són els noms de família que fa servir `fonts` a tokens.ts.
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_800ExtraBold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
    AtkinsonHyperlegibleNext_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Si una font falla, l'app arrenca igualment amb la del sistema.
  if (!ready) return null;

  return (
    <AppProviders>
      <ThemedApp />
    </AppProviders>
  );
}

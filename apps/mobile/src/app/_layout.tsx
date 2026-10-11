import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  AtkinsonHyperlegibleNext_800ExtraBold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AppProviders } from '@/core/providers/AppProviders';
import { colors } from '@/core/theme/tokens';

void SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.nit,
    card: colors.card,
    text: colors.lluna,
    border: colors.linia,
    primary: colors.far,
  },
};

function RootStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.nit } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="punt/[id]"
        options={{ headerShown: true, title: t('point.title'), headerTintColor: colors.lluna }}
      />
      <Stack.Screen name="benvinguda" options={{ presentation: 'modal' }} />
    </Stack>
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
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <RootStack />
      </ThemeProvider>
    </AppProviders>
  );
}

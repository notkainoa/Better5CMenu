import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import WebStackHost from '@/components/WebStackHost';
import { Theme } from '@/constants/Theme';
import { SettingsProvider } from '@/lib/settings';
import { WebStackProvider } from '@/lib/webStack';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Navigator chrome is always black: the app renders its own dark shell
// (Theme.black), so the navigation theme must not paint the light theme's
// white card/background behind screens during push transitions.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Theme.black, card: Theme.black },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <SettingsProvider>
      <WebStackProvider>
        <ThemeProvider value={NAV_THEME}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: Theme.black } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="search"
              options={{
                headerShown: false,
                animation: 'default',
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                headerShown: false,
                animation: 'default',
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="webapp" options={{ headerShown: false }} />
            <Stack.Screen name="webapp/onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="webapp/onboarding/2" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <WebStackHost />
        </ThemeProvider>
      </WebStackProvider>
    </SettingsProvider>
  );
}

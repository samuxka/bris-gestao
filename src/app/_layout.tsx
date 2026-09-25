import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_500Medium, Outfit_700Bold } from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading, isUnlocked, biometricsEnabled } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to the login page.
      router.replace('/(auth)/login');
    } else if (user) {
      if (!isUnlocked && biometricsEnabled) {
        // Redirect to unlock screen if biometrics are enabled and app is locked
        if (segments[1] !== 'unlock') {
          router.replace('/(auth)/unlock');
        }
      } else if (inAuthGroup && segments[1] !== 'unlock') {
        // Redirect away from login/auth pages to the main app
        router.replace('/(app)/(tabs)');
      } else if (isUnlocked && segments[1] === 'unlock') {
        // If unlocked but still on unlock screen, go to app
        router.replace('/(app)/(tabs)');
      }
    }
  }, [user, isLoading, fontsLoaded, segments, isUnlocked, biometricsEnabled]);

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

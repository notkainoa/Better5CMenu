import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { writeHandoff } from '@/lib/webAppOnboarding';

/**
 * `/webapp/onboarding`: writes the one-time handoff, then replaces to
 * `/webapp?onboarding=1` so the overlay force-shows step 1. Static export
 * emits `webapp/onboarding.html`, so the link works without a server.
 * Native has no URLs, so it renders the normal app instead.
 */
export default function WebAppOnboarding() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }
  writeHandoff('1');
  return <Redirect href="/webapp?onboarding=1" />;
}

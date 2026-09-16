import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { writeHandoff } from '@/lib/webAppOnboarding';

/**
 * `/webapp/onboarding/2`: same as `/webapp/onboarding` but targets step 2.
 * This is the link users copy when breaking out of an in-app browser.
 * Native renders the normal app instead.
 */
export default function WebAppOnboarding2() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }
  writeHandoff('2');
  return <Redirect href="/webapp?onboarding=2" />;
}

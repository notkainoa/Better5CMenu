import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import FrozenHalls from '@/components/FrozenHalls';
import WebAppOnboardingHost from '@/components/WebAppOnboardingHost';
import { usePinUrlPath } from '@/lib/pinUrlPath';

/**
 * `/webapp`: the same halls without page URLs. Hall switches and
 * settings/search open in memory, so the address bar stays on `/webapp`.
 * The normal app at `/` is untouched. Native has no URLs, so it renders the
 * normal app instead.
 */
export default function WebApp() {
  usePinUrlPath(Platform.OS === 'web' ? '/webapp' : null);
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }
  return (
    <>
      <FrozenHalls />
      <WebAppOnboardingHost />
    </>
  );
}

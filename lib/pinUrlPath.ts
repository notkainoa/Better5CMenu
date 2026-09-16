import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ONBOARDING_QUERY } from '@/lib/webAppOnboarding';

/**
 * True when `search` is exactly `?onboarding=1` or `?onboarding=2` with no
 * other params. The onboarding host consumes the query itself, so the pin
 * must tolerate it until then.
 */
function isOnboardingQuery(search: string): boolean {
  const params = new URLSearchParams(search);
  const keys = [...params.keys()];
  return (
    keys.length === 1 &&
    keys[0] === ONBOARDING_QUERY &&
    (params.get(ONBOARDING_QUERY) === '1' || params.get(ONBOARDING_QUERY) === '2')
  );
}

/**
 * Pin the web address bar to `target` while it is set. Any in-app
 * `pushState`/`replaceState` (including expo-router's own) is rewritten back
 * to the target. Comparison is against the raw pathname so variants like a
 * trailing slash are canonicalized too. Browser Back/Forward is intentionally
 * left alone: Back means leave the page. Pass `null` to disable.
 */
export function usePinUrlPath(target: string | null) {
  useEffect(() => {
    if (target == null || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const { history } = window;
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);

    const pin = () => {
      if (window.location.pathname !== target) {
        replace(history.state, '', target);
        return;
      }
      if (!window.location.search && !window.location.hash) return;
      // Tolerate the onboarding handoff query until the host consumes it.
      if (isOnboardingQuery(window.location.search) && !window.location.hash) return;
      replace(history.state, '', target);
    };

    history.pushState = (data, unused, url) => {
      push(data, unused, url);
      pin();
    };
    history.replaceState = (data, unused, url) => {
      replace(data, unused, url);
      pin();
    };
    pin();

    return () => {
      history.pushState = push;
      history.replaceState = replace;
    };
  }, [target]);
}

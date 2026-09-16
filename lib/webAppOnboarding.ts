import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Query param that forces the onboarding overlay to show (`?onboarding=1|2`). */
export const ONBOARDING_QUERY = 'onboarding';

const DONE_KEY = 'better5cmenu:webapp-onboarding:v1';
const DONE_VALUE = 'done';
const HANDOFF_KEY = 'better5cmenu:webapp-onboarding-handoff';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** True once the user has completed onboarding (Done); persists per origin. */
export async function readDoneFlag(): Promise<boolean> {
  return (await AsyncStorage.getItem(DONE_KEY)) === DONE_VALUE;
}

/** Marks onboarding complete so `/webapp` stops auto-showing it. */
export async function writeDoneFlag(): Promise<void> {
  await AsyncStorage.setItem(DONE_KEY, DONE_VALUE);
}

/** Clears the completion flag (Settings "replay" escape hatch). */
export async function clearDoneFlag(): Promise<void> {
  await AsyncStorage.removeItem(DONE_KEY);
}

/**
 * Reads + consumes the one-time redirector handoff. Web-only; the entry is
 * removed so Back never replays it. Null on native or when absent/invalid.
 */
export function readConsumeHandoff(): '1' | '2' | null {
  if (!isWeb()) return null;
  try {
    const value = window.sessionStorage.getItem(HANDOFF_KEY);
    window.sessionStorage.removeItem(HANDOFF_KEY);
    return value === '1' || value === '2' ? value : null;
  } catch {
    return null;
  }
}

/**
 * One-time handoff written by the `/webapp/onboarding*` redirectors.
 * No-op on native.
 */
export function writeHandoff(step: '1' | '2'): void {
  if (!isWeb()) return;
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, step);
  } catch {
    // Storage blocked: the query param still carries the step.
  }
}

/**
 * UA hint for in-app browsers. True for the iOS Google app (`GSA/` token) or
 * a WebView (`; wv)`) carrying a Google token. Hint only — the UI asks the
 * user, never auto-routes. False on native.
 */
export function uaLikelyInApp(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  if (ua.includes('GSA/')) return true;
  return ua.includes('; wv)') && (/google/i.test(ua) || /gsa/i.test(ua));
}

/** True when launched from the Home Screen (installed PWA). False on native. */
export function isStandalone(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  if ((navigator as any).standalone === true) return true;
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  );
}

/**
 * Coarse pointer or mobile UA. Gates first-visit auto-show (no desktop nag).
 * False on native.
 */
export function isMobileDevice(): boolean {
  if (!isWeb()) return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    return true;
  }
  return (
    typeof navigator !== 'undefined' && /iphone|ipad|ipod|android/i.test(navigator.userAgent ?? '')
  );
}

export type OnboardingEntry =
  { visible: false } | { visible: true; initialStep: 'opt-in' | 'browser-check' | 'picker' };

/**
 * Decides overlay entry. Forced handoff/query wins (even if dismissed);
 * otherwise first-visit auto-show on mobile browsers that aren't installed.
 */
export function resolveOnboardingEntry(opts: {
  handoff: '1' | '2' | null;
  query: string | null;
  done: boolean;
  standalone: boolean;
  mobile: boolean;
}): OnboardingEntry {
  if (opts.query === '2' || opts.handoff === '2') {
    return { visible: true, initialStep: 'picker' };
  }
  if (opts.query === '1' || opts.handoff === '1') {
    return { visible: true, initialStep: 'browser-check' };
  }
  if (!opts.done && !opts.standalone && opts.mobile) {
    return { visible: true, initialStep: 'opt-in' };
  }
  return { visible: false };
}

/** Absolute step-2 link built from the runtime origin (never hardcoded). */
export function buildOnboardingCopyUrl(): string {
  if (!isWeb()) return '/webapp/onboarding/2';
  return `${window.location.origin}/webapp/onboarding/2`;
}

/**
 * Copies text, falling back to a hidden textarea + execCommand for in-app
 * webviews where the async clipboard API is blocked. Reports success.
 */
export async function copyTextWithFallback(text: string): Promise<boolean> {
  if (!isWeb()) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/Theme';
import { useIsWebApp } from '@/lib/webApp';
import {
  ONBOARDING_QUERY,
  buildOnboardingCopyUrl,
  copyTextWithFallback,
  isMobileDevice,
  isStandalone,
  readConsumeHandoff,
  readDoneFlag,
  resolveOnboardingEntry,
  uaLikelyInApp,
  writeDoneFlag,
} from '@/lib/webAppOnboarding';
import type { OnboardingEntry } from '@/lib/webAppOnboarding';

// Local step machine. Forced entries skip opt-in and start at
// browser-check/picker; only Done writes the dismissal flag.
type Step = 'opt-in' | 'browser-check' | 'breakout' | 'picker' | 'instructions';
type Browser = 'safari' | 'chrome' | 'other';

const ALL_STEPS: readonly Step[] = [
  'opt-in',
  'browser-check',
  'breakout',
  'picker',
  'instructions',
];

function asStep(value: unknown): Step | null {
  return typeof value === 'string' && (ALL_STEPS as readonly string[]).includes(value)
    ? (value as Step)
    : null;
}

// Normalize the foundation entry without depending on its exact field types.
function entryView(entry: OnboardingEntry): { visible: boolean; initialStep: Step } {
  const rec = entry as unknown as { visible?: unknown; initialStep?: unknown };
  return { visible: rec.visible === true, initialStep: asStep(rec.initialStep) ?? 'opt-in' };
}

type Sub = { title: string; shot: string };

function substepsFor(browser: Browser): Sub[] {
  const shared: Sub[] = [
    { title: 'Tap View more', shot: 'Screenshot: View more' },
    { title: 'Scroll down → Add to Home Screen', shot: 'Screenshot: Add to Home Screen' },
    {
      title: 'Enter the name, make sure Open as Web App is on, tap Add',
      shot: 'Screenshot: Name and Add',
    },
    {
      title: '5C Dining is installed just like a normal app!',
      shot: 'Screenshot: Installed app',
    },
  ];
  if (browser === 'safari') {
    return [
      {
        title:
          'Tap the More icon on the left of the URL bar (at the bottom; if your bar is at the top, same icons, mirrored)',
        shot: 'Screenshot: More icon',
      },
      { title: 'Tap Share', shot: 'Screenshot: Share' },
      ...shared,
    ];
  }
  if (browser === 'chrome') {
    return [
      {
        title: 'Tap the Share icon on the right of the URL bar (top)',
        shot: 'Screenshot: Share',
      },
      ...shared,
    ];
  }
  return [
    {
      title:
        'Most browsers have a visible Share button or a three-dot menu with Share inside — find it and tap Share.',
      shot: 'Screenshot: Share button',
    },
    ...shared,
  ];
}

const BROWSERS: readonly { id: Browser; label: string; glyph: string }[] = [
  { id: 'safari', label: 'Safari', glyph: 'S' },
  { id: 'chrome', label: 'Chrome', glyph: 'C' },
  { id: 'other', label: 'Other', glyph: '⋮' },
];

/** Install-instructions overlay for `/webapp` (web only). Mirrors WebStackHost. */
export default function WebAppOnboardingHost() {
  const webApp = useIsWebApp();
  if (Platform.OS !== 'web' || !webApp) return null;
  // Leaving `/webapp` unmounts the flow, so overlay state can never
  // resurrect on return — no reset effect needed.
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [resolved, setResolved] = useState<{ visible: boolean; initialStep: Step } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>('opt-in');
  const [browser, setBrowser] = useState<Browser | null>(null);
  const [sub, setSub] = useState(0);
  const [copied, setCopied] = useState(false);
  const [likelyInApp, setLikelyInApp] = useState(false);

  // Decide once per mount. Until storage is read we render nothing (no flash).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let alive = true;
    (async () => {
      const done = await readDoneFlag();
      if (!alive) return;
      const handoff = readConsumeHandoff();
      const raw = params[ONBOARDING_QUERY];
      const decided = resolveOnboardingEntry({
        done,
        handoff,
        query: Array.isArray(raw) ? raw[0] : raw,
        standalone: isStandalone(),
        mobile: isMobileDevice(),
      });
      if (!alive) return;
      const view = entryView(decided);
      setLikelyInApp(uaLikelyInApp());
      setStep(view.initialStep);
      setResolved(view);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => {
    // Closing writes nothing: the overlay re-shows on next visit.
    setDismissed(true);
  }, []);

  const stepBack = useCallback(() => {
    if (step === 'instructions' && sub > 0) {
      setSub(sub - 1);
    } else if (step === 'instructions' || step === 'picker' || step === 'breakout') {
      setStep(
        step === 'breakout' ? 'browser-check' : step === 'picker' ? 'browser-check' : 'picker',
      );
    } else if (step === 'browser-check') {
      if (resolved?.initialStep === 'opt-in') setStep('opt-in');
      else setDismissed(true);
    } else {
      setDismissed(true);
    }
  }, [step, sub, resolved]);

  // Escape steps back; it never writes the done flag.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stepBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepBack]);

  const onDone = useCallback(async () => {
    await writeDoneFlag();
    setDismissed(true);
  }, []);

  const copyUrl = Platform.OS === 'web' && step === 'breakout' ? buildOnboardingCopyUrl() : '';
  const onCopy = useCallback(async () => {
    try {
      // False = clipboard blocked; the selectable URL below is the manual path.
      setCopied(await copyTextWithFallback(copyUrl));
    } catch {
      setCopied(false);
    }
  }, [copyUrl]);

  const pickBrowser = useCallback((id: Browser) => {
    setBrowser(id);
    setSub(0);
    setStep('instructions');
  }, []);

  if (dismissed || !resolved?.visible) return null;

  const subs = substepsFor(browser ?? 'safari');
  const current = subs[Math.min(sub, subs.length - 1)]!;
  const isLastSub = sub >= subs.length - 1;

  // Sticky footer only where the body has no navigation of its own:
  // browser-check, breakout, and picker navigate via body buttons.
  const showFooter = step === 'opt-in' || step === 'instructions';

  const footerPrimary =
    step === 'instructions' && isLastSub
      ? { label: 'Done', action: onDone }
      : step === 'instructions'
        ? { label: 'Next', action: () => setSub(sub + 1) }
        : { label: 'Next', action: () => setStep('browser-check') };

  return (
    <View style={styles.cover} role="dialog" accessibilityLabel="Install instructions">
      <View style={styles.header}>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close install instructions"
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {step === 'instructions' ? (
        <View style={styles.topbar}>
          {BROWSERS.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => pickBrowser(b.id)}
              accessibilityRole="button"
              accessibilityLabel={b.label}
              style={[styles.topbarItem, browser === b.id && styles.topbarItemActive]}
            >
              <Text style={styles.topbarText}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {step === 'opt-in' ? (
          <>
            <Text style={styles.headline}>Add 5C Dining to your Home Screen?</Text>
            <Pressable
              onPress={() => setStep('browser-check')}
              accessibilityRole="button"
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Yes, continue</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/')}
              accessibilityRole="button"
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>No, take me to the app</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'browser-check' ? (
          likelyInApp ? (
            <>
              <Text style={styles.headline}>Looks like you&apos;re in the Google app</Text>
              <Pressable
                onPress={() => setStep('breakout')}
                accessibilityRole="button"
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Yep</Text>
              </Pressable>
              <Pressable
                onPress={() => setStep('picker')}
                accessibilityRole="button"
                accessibilityLabel="No I'm not"
                style={styles.textButton}
              >
                <Text style={styles.textButtonText}>No I&apos;m not</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.headline}>Are you in a real browser? Not the Google app?</Text>
              <Pressable
                onPress={() => setStep('picker')}
                accessibilityRole="button"
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => setStep('breakout')}
                accessibilityRole="button"
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>No</Text>
              </Pressable>
            </>
          )
        ) : null}

        {step === 'breakout' ? (
          <>
            <Text style={styles.headline}>
              Open this site in a real browser (Safari, Chrome, etc.)
            </Text>
            <Pressable
              onPress={onCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy link"
              style={styles.primary}
            >
              <Text style={styles.primaryText}>{copied ? 'Copied!' : 'Copy link'}</Text>
            </Pressable>
            <Text selectable style={styles.url}>
              {copyUrl}
            </Text>
            <Text style={styles.hint}>tap … → Open in Safari/Chrome</Text>
            <Pressable
              onPress={() => setStep('picker')}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Next' : 'Continue anyway'}
              style={copied ? styles.primary : styles.secondary}
            >
              <Text style={copied ? styles.primaryText : styles.secondaryText}>
                {copied ? 'Next →' : 'Continue anyway →'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === 'picker' ? (
          <>
            <Text style={styles.headline}>Which browser are you using?</Text>
            {BROWSERS.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => pickBrowser(b.id)}
                accessibilityRole="button"
                accessibilityLabel={b.label}
                style={styles.row}
              >
                <View style={styles.glyph}>
                  <Text style={styles.glyphText}>{b.glyph}</Text>
                </View>
                <Text style={styles.rowText}>{b.label}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 'instructions' ? (
          <>
            <Text style={styles.counter}>
              Step {Math.min(sub + 1, subs.length)} of {subs.length}
            </Text>
            <Text style={styles.headline}>{current.title}</Text>
            <View style={styles.shot}>
              <Text style={styles.shotText}>{current.shot}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      {showFooter ? (
        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
          <Pressable
            onPress={stepBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
          >
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={footerPrimary.action}
            accessibilityRole="button"
            accessibilityLabel={footerPrimary.label}
            style={styles.next}
          >
            <Text style={styles.primaryText}>{footerPrimary.label}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    backgroundColor: Theme.black,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: Theme.white,
    fontSize: 20,
  },
  topbar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topbarItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.darkGray,
  },
  topbarItemActive: {
    borderColor: Theme.white,
  },
  topbarText: {
    color: Theme.white,
    fontSize: 15,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 12,
  },
  headline: {
    color: Theme.white,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  counter: {
    color: Theme.gray,
    fontSize: 14,
  },
  hint: {
    color: Theme.gray,
    fontSize: 15,
  },
  url: {
    color: Theme.gray,
    fontSize: 14,
  },
  primary: {
    backgroundColor: Theme.white,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    color: Theme.black,
    fontSize: 17,
    fontWeight: '600',
  },
  secondary: {
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Theme.gray,
  },
  secondaryText: {
    color: Theme.white,
    fontSize: 17,
  },
  textButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonText: {
    color: Theme.white,
    fontSize: 17,
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.darkGray,
    padding: 12,
    minHeight: 64,
  },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.darkerGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    color: Theme.white,
    fontSize: 20,
    fontWeight: '600',
  },
  rowText: {
    color: Theme.white,
    fontSize: 17,
    flex: 1,
  },
  rowChevron: {
    color: Theme.gray,
    fontSize: 22,
  },
  shot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Theme.gray,
    borderRadius: 8,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  shotText: {
    color: Theme.gray,
    fontSize: 15,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.darkGray,
  },
  back: {
    flex: 1,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.gray,
  },
  next: {
    flex: 2,
    backgroundColor: Theme.white,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.4,
  },
});

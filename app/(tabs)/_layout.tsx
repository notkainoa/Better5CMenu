import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NativePager, { type NativePagerHandle } from '@/components/NativePager';
import { useSharedValue } from 'react-native-reanimated';
import DiningTabBar from '@/components/DiningTabBar';
import HallTabBar from '@/components/HallTabBar';
import { AppShell, HallChrome } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { DimProvider } from '@/lib/dim';
import { DayProvider } from '@/lib/day';
import { orderedHalls } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { TabNavProvider } from '@/lib/tabNav';
import McConnellPage from './mcconnell';
import FraryPage from './frary';
import HochPage from './hoch';
import MalottPage from './malott';
import CollinsPage from './collins';
import FrankPage from './frank';
import OldenborgPage from './oldenborg';

const PAGES = {
  mcconnell: McConnellPage,
  frary: FraryPage,
  hoch: HochPage,
  malott: MalottPage,
  collins: CollinsPage,
  frank: FrankPage,
  oldenborg: OldenborgPage,
} as const;

/**
 * Native tab navigator: the pager owns position (real ViewPager2 /
 * UIPageViewController swipes). Swipes and taps never touch the router, so
 * there is no sync loop and no second animation. The route only matters at
 * launch / deep links, which snap the pager without animation.
 * Web uses _layout.web.tsx (expo-router Tabs, no swipe).
 */
function TabLayoutNative() {
  const segments = useSegments();
  const { loaded, hallOrder } = usePrefs();
  const pagerRef = useRef<NativePagerHandle>(null);

  const order: string[] = useMemo(() => orderedHalls(hallOrder).map((h) => h.id), [hallOrder]);

  const [initialKey] = useState(() => {
    const name = segments.at(1) ?? '';
    return order.includes(name) ? name : order[0];
  });
  const [activeKey, setActiveKey] = useState(initialKey);
  const activeKeyRef = useRef(activeKey);
  // EXP-3: float page index owned by the pager, read by the tab bar.
  const progress = useSharedValue(Math.max(0, order.indexOf(initialKey)));
  // EXP-9: explicit prep flag, set synchronously in navigate() ahead of the
  // native animation. SharedValue write applies UI-side before the pager
  // moves over the bridge.
  const prep = useSharedValue(0);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const handlePageSelected = useCallback(
    (i: number) => {
      prep.set(0); // EXP-9: settle clears prep; motion is done.
      setActiveKey(order[i] ?? '');
    },
    [order, prep],
  );

  const navigate = useCallback(
    (name: string) => {
      if (name === activeKeyRef.current) return;
      const i = order.indexOf(name);
      if (i >= 0) {
        // EXP-9: prep (round tops, hide joinery) runs in the same tick as the
        // press — strictly before pagerRef.setPage() starts motion.
        prep.set(1);
        setActiveKey(name);
        pagerRef.current?.setPage(i);
      }
    },
    [order, prep],
  );

  const pages = useMemo(
    () =>
      order.map((name) => {
        const Page = PAGES[name as keyof typeof PAGES];
        return (
          <View key={name} collapsable={false} style={styles.fill}>
            <Page />
          </View>
        );
      }),
    [order],
  );

  useEffect(() => {
    const name = segments.at(1) ?? '';
    if (!order.includes(name) || name === activeKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external nav sync
    setActiveKey(name);
    pagerRef.current?.setPageWithoutAnimation(order.indexOf(name));
  }, [segments, order, activeKey]);

  useEffect(() => {
    // Only when hall order changes. Including activeKey here would snap the
    // pager on every chip tap and cancel the swipe animation.
    const i = Math.max(0, order.indexOf(activeKeyRef.current));
    pagerRef.current?.setPageWithoutAnimation(i);
    progress.set(i); // EXP-3: keep progress on the same page as the pager.
  }, [order, progress]);

  if (!loaded) return <View style={[styles.fill, styles.boot]} />;

  return (
    <TabNavProvider activeKey={activeKey} navigate={navigate} progress={progress} prep={prep}>
      <AppShell>
        <StatusBar style="light" />
        <HallChrome>
          <HallTabBar />
          <NativePager
            ref={pagerRef}
            initialPage={Math.max(0, order.indexOf(initialKey))}
            onPageSelected={handlePageSelected}
            onPageScroll={(e) => {
              progress.set(e.position + e.offset); // EXP-3
            }}
          >
            {pages}
          </NativePager>
        </HallChrome>
        <DiningTabBar />
      </AppShell>
    </TabNavProvider>
  );
}

export default function TabLayout() {
  return (
    <DayProvider>
      <DimProvider>
        <TabLayoutNative />
      </DimProvider>
    </DayProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  boot: { backgroundColor: Theme.black },
});

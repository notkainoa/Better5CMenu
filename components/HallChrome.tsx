import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/Theme';

/** Black strip around the grouped hall chrome. */
export const CHROME_INSET = 8;
/** Hall chips and day pills. Outer chrome is this plus the inset. */
export const INNER_CHIP_RADIUS = 14;
/**
 * Outer corners of the hall chrome (top) and the day-button card.
 * Nested with 14pt inner chips / day pills: inner + inset.
 */
export const CHROME_RADIUS = INNER_CHIP_RADIUS + CHROME_INSET;
/** School card bottom corners. Nested inside the hall chrome's bottom radius. */
export const SCHOOL_RADIUS = 24;
/**
 * Bottom corners of the hall chrome. Nested with the school card's 24pt
 * bottom corners: inner + inset.
 */
export const CHROME_BOTTOM_RADIUS = SCHOOL_RADIUS + CHROME_INSET;
/** Concave fillet where a hall chip or the days card joins the hall chrome. */
export const CHROME_JOIN_EAR = CHROME_RADIUS;

/**
 * Fillet and convex corner that meet when a tab sits `d` in from a card edge.
 * Both scale together so they stay tangent; they do not snap to 0/max.
 */
export function joinRadii(
  d: number,
  earMax: number,
  cornerMax: number,
): { ear: number; corner: number } {
  if (d <= 0.5) return { ear: 0, corner: 0 };
  const span = earMax + cornerMax;
  if (span <= 0) return { ear: 0, corner: 0 };
  const t = Math.min(1, d / span);
  return { ear: t * earMax, corner: t * cornerMax };
}

/** Inner radius nested by `inset` inside an outer rounded rect. */
export function nestedRadius(outer: number, inset: number = CHROME_INSET): number {
  return Math.max(0, outer - inset);
}

type BottomJoin = { bl: number; br: number };

const DEFAULT_JOIN: BottomJoin = { bl: CHROME_BOTTOM_RADIUS, br: CHROME_BOTTOM_RADIUS };

const BottomJoinContext = createContext<{
  join: BottomJoin;
  setJoin: Dispatch<SetStateAction<BottomJoin>>;
}>({ join: DEFAULT_JOIN, setJoin: () => {} });

export function useHallBottomJoin() {
  return useContext(BottomJoinContext);
}

/**
 * EXP-7: 0 at rest, 1 while the pager is between pages. Lets hall pages
 * restyle their top corners in flight. Null outside AppShell (web-safe).
 */
const FlightContext = createContext<SharedValue<number> | null>(null);

export function useFlight(): SharedValue<number> | null {
  return useContext(FlightContext);
}

/**
 * EXP-8: live CornerMask radii, published by the tab bar. Hall pages copy
 * these for their own top corners so both agree, including morphs.
 */
const TopCornerContext = createContext<{
  l: SharedValue<number>;
  r: SharedValue<number>;
} | null>(null);

export function useTopCorners(): {
  l: SharedValue<number>;
  r: SharedValue<number>;
} | null {
  return useContext(TopCornerContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [join, setJoin] = useState<BottomJoin>(DEFAULT_JOIN);
  const joinValue = useMemo(() => ({ join, setJoin }), [join]);
  const flight = useSharedValue(0);
  const topL = useSharedValue(CHROME_RADIUS - CHROME_INSET);
  const topR = useSharedValue(CHROME_RADIUS - CHROME_INSET);
  const topCorners = useMemo(() => ({ l: topL, r: topR }), [topL, topR]);
  return (
    <BottomJoinContext.Provider value={joinValue}>
      <FlightContext.Provider value={flight}>
        <TopCornerContext.Provider value={topCorners}>
          <View
            style={[
              styles.shell,
              {
                paddingTop: Math.max(insets.top, CHROME_INSET),
                paddingLeft: Math.max(insets.left, CHROME_INSET),
                paddingRight: Math.max(insets.right, CHROME_INSET),
              },
            ]}
          >
            {children}
          </View>
        </TopCornerContext.Provider>
      </FlightContext.Provider>
    </BottomJoinContext.Provider>
  );
}

/** Rounded card around the hall tabs and the dining hall page. */
export function HallChrome({ children }: { children: ReactNode }) {
  const { join } = useHallBottomJoin();
  return (
    <View
      style={[styles.hall, { borderBottomLeftRadius: join.bl, borderBottomRightRadius: join.br }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Theme.black,
  },
  hall: {
    flex: 1,
    backgroundColor: Theme.darkerGray,
    borderTopLeftRadius: CHROME_RADIUS,
    borderTopRightRadius: CHROME_RADIUS,
    paddingBottom: CHROME_INSET,
    overflow: 'hidden',
  },
});

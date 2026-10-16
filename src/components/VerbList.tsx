import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { VerbRow } from './VerbRow';
import { autoScrollStep } from './verbListAutoScroll';
import type { Verb } from '../types';

export type VerbListProps = {
  verbs: Verb[];
  empty: ReactElement;
  /**
   * Why a row is on show, when the headword does not say it — a search that
   * matched one of the six whole words. `null` on an ordinary row.
   */
  hintOf: (verb: Verb) => string | null;
  /**
   * Whether a row may be picked up and dragged.
   *
   * Off while the list is a filtered subset: `toIndex` is a slot among the
   * group's entries, and a subset's rows are neither that slot nor one measured
   * pitch apart once the matching rows carry a hint line — so the drop would
   * land somewhere the user never aimed at.
   */
  reorderEnabled: boolean;
  onPressVerb: (verb: Verb) => void;
  /** Ordering is the native affordance; the web twin accepts and ignores it. */
  onReorder: (verbId: string, toIndex: number) => void;
};

/**
 * How long a row must be held before it can be picked up.
 *
 * The pick-up is a `Gesture.Pan` created with `activateAfterLongPress`, which
 * gesture-handler enforces in its own native handler (`PanGestureHandler`'s
 * `shouldFail()`): a finger that travels past the platform's touch slop before
 * the hold elapses fails the gesture outright, so a swipe scrolls the list and
 * never picks a row up. That is why the pick-up is not a
 * `Pressable.onLongPress`: React Native cancels that timer only from the JS
 * touch-move events it receives, and under a scrolling list they are not
 * guaranteed to arrive.
 */
const HOLD_MS = 400;

/** How the held row settles into its slot before the reorder is written. */
const SPRING = {
  damping: 20,
  mass: 0.2,
  stiffness: 100,
  overshootClamping: false,
  restSpeedThreshold: 0.2,
  restDisplacementThreshold: 0.2,
} as const;

/** How often the list's own scrolling is nudged along during a drag. */
const AUTO_SCROLL_INTERVAL_MS = 16;
/** If the settle animation never reports back, the reorder still lands. */
const SETTLE_FALLBACK_MS = 400;

/**
 * Nothing, on purpose.
 *
 * React Native calls `onPress` on release after a hold unless a long-press
 * handler is set, so a row picked up and put straight back would open the
 * detail screen. The Pressable's own long press exists only to swallow that
 * press; the pick-up itself is the gesture below.
 */
const swallowed = () => {};

/**
 * The drag state every row shares: one drag moves all of them at once — the
 * picked-up row follows the finger while the rows it passes step aside by a
 * slot.
 */
type DragShared = {
  /** The row being dragged, or `-1`. */
  activeIndex: SharedValue<number>;
  /** Where it would land if the finger lifted now, or `-1`. */
  spacerIndex: SharedValue<number>;
  /** How far the picked-up row is drawn from its recorded position. */
  hoverTranslate: SharedValue<number>;
  /** The finger's travel alone, before the list's own scrolling is added. */
  touchTranslate: SharedValue<number>;
  /** One row's height: the pitch every slot is measured in. */
  pitch: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  /** The scroll offset when this drag began. */
  scrollStart: SharedValue<number>;
  /** The row this gesture picked up, or `-1`: only it may clean up after itself. */
  owner: SharedValue<number>;
  begin: (index: number) => void;
  release: (from: number, to: number) => void;
  settle: (from: number, to: number) => void;
  abort: () => void;
};

type DraggableRowProps = {
  verb: Verb;
  rowIndex: number;
  lifted: boolean;
  hint?: string;
  reorderEnabled: boolean;
  onPress: () => void;
  onRowLayout: (height: number) => void;
  shared: DragShared;
};

/**
 * One row, plus the gesture that picks it up and carries it.
 *
 * A single gesture does both jobs. While it waits out `HOLD_MS` the native
 * scroll view still owns the touch, so the list scrolls; once the hold matures
 * this handler is ACTIVE and tracks the finger itself. Nothing else competes
 * for the pointer, so there is no arbitration to lose and no drag state a
 * cancelled gesture can strand — `onFinalize` always runs.
 */
function DraggableRow({
  verb,
  rowIndex,
  lifted,
  hint,
  reorderEnabled,
  onPress,
  onRowLayout,
  shared,
}: DraggableRowProps) {
  const {
    activeIndex,
    spacerIndex,
    hoverTranslate,
    touchTranslate,
    pitch,
    scrollOffset,
    scrollStart,
    owner,
    begin,
    release,
    settle,
    abort,
  } = shared;
  // True between the release and the settle callback: it is how `onFinalize`
  // tells a finished drag from a failed or cancelled one.
  const settling = useSharedValue(false);

  const pickUp = useMemo(
    () =>
      Gesture.Pan()
        .enabled(reorderEnabled)
        .activateAfterLongPress(HOLD_MS)
        .onStart(() => {
          settling.value = false;
          owner.value = rowIndex;
          touchTranslate.value = 0;
          scrollStart.value = scrollOffset.value;
          activeIndex.value = rowIndex;
          runOnJS(begin)(rowIndex);
        })
        .onUpdate(event => {
          touchTranslate.value = event.translationY;
        })
        .onEnd(() => {
          const from = activeIndex.value;
          const to = spacerIndex.value;
          if (from < 0 || to < 0 || pitch.value <= 0) {
            return;
          }
          settling.value = true;
          // Land in the slot first: the list is reordered once the row is
          // already there, so the write moves nothing the eye has not seen
          // move. The scroll delta is taken back out, because the finger's
          // travel already includes however far the list scrolled itself.
          const landing =
            (to - from) * pitch.value -
            (scrollOffset.value - scrollStart.value);
          touchTranslate.value = withSpring(landing, SPRING, finished => {
            if (finished) {
              runOnJS(settle)(from, to);
            }
          });
          runOnJS(release)(from, to);
        })
        .onFinalize(() => {
          if (settling.value) {
            settling.value = false;
            return;
          }
          if (owner.value !== rowIndex) {
            // The hold never matured — this was a swipe, and it picked nothing
            // up. Another row settling from an earlier drag is left alone.
            return;
          }
          // A drag the system cancelled after the pick-up: put the row back.
          owner.value = -1;
          activeIndex.value = -1;
          touchTranslate.value = 0;
          scrollStart.value = 0;
          runOnJS(abort)();
        }),
    [
      abort,
      activeIndex,
      begin,
      owner,
      pitch,
      release,
      reorderEnabled,
      rowIndex,
      scrollOffset,
      scrollStart,
      settle,
      settling,
      spacerIndex,
      touchTranslate,
    ],
  );

  const style = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active < 0) {
      return { transform: [{ translateY: 0 }], zIndex: 0 };
    }
    if (rowIndex === active) {
      return { transform: [{ translateY: hoverTranslate.value }], zIndex: 999 };
    }
    // A row between where the drag started and where it would land steps one
    // slot out of the way, opening the gap the active row is heading for.
    const spacer = spacerIndex.value;
    let shift = 0;
    if (spacer >= 0 && active < rowIndex && rowIndex <= spacer) {
      shift = -pitch.value;
    } else if (spacer >= 0 && spacer <= rowIndex && rowIndex < active) {
      shift = pitch.value;
    }
    return {
      transform: [{ translateY: withSpring(shift, SPRING) }],
      zIndex: 0,
    };
  }, [rowIndex]);

  return (
    <GestureDetector gesture={pickUp}>
      <Animated.View
        style={style}
        onLayout={event => onRowLayout(event.nativeEvent.layout.height)}
      >
        <VerbRow
          verb={verb}
          hint={hint}
          dragging={lifted}
          onPress={onPress}
          onLongPress={swallowed}
        />
      </Animated.View>
    </GestureDetector>
  );
}

/** Android and iOS: hold a row to pick it up, then drag it into place. */
export function VerbList({
  verbs,
  empty,
  hintOf,
  reorderEnabled,
  onPressVerb,
  onReorder,
}: VerbListProps) {
  const listRef = useRef<FlatList<Verb>>(null);
  const count = verbs.length;

  const [dragging, setDragging] = useState(false);
  const [lifted, setLifted] = useState<number | null>(null);

  const scrollOffset = useSharedValue(0);
  const scrollStart = useSharedValue(0);
  const touchTranslate = useSharedValue(0);
  const activeIndex = useSharedValue(-1);
  const owner = useSharedValue(-1);
  // One row's height, measured rather than assumed: the wrapper reports the
  // card plus the gap under it, so a different font scale still lands right.
  const pitch = useSharedValue(0);
  const containerHeight = useSharedValue(0);

  const hoverTranslate = useDerivedValue(
    () => touchTranslate.value + (scrollOffset.value - scrollStart.value),
  );
  const spacerIndex = useDerivedValue(() => {
    if (activeIndex.value < 0 || pitch.value <= 0) {
      return -1;
    }
    const top = activeIndex.value * pitch.value + hoverTranslate.value;
    const slot = Math.round(top / pitch.value);
    return Math.max(0, Math.min(slot, count - 1));
  });
  // Where the dragged row's centre sits on screen. The edge check reads this
  // rather than the finger, so it stays right while the list scrolls itself.
  const hoverScreenY = useDerivedValue(() => {
    if (activeIndex.value < 0) {
      return 0;
    }
    return (
      activeIndex.value * pitch.value +
      hoverTranslate.value +
      pitch.value / 2 -
      scrollOffset.value
    );
  });

  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** One reorder write per drag, whichever callback gets there first. */
  const settled = useRef(true);
  const verbsRef = useRef(verbs);
  verbsRef.current = verbs;

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current !== null) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  }, []);

  /**
   * Drag the list towards the edge the row is resting against.
   *
   * Driven from JS on a timer rather than from the gesture's per-frame worklet:
   * the scroll command is a JS-thread call either way, and a steady tick reads
   * better than a `scrollToOffset` fired at every touch sample.
   */
  const autoScrollTick = useCallback(() => {
    if (activeIndex.value < 0 || pitch.value <= 0) {
      return;
    }
    const delta = autoScrollStep(hoverScreenY.value, containerHeight.value);
    if (delta === 0) {
      return;
    }
    // The scroll view clamps the far end itself, so nothing here has to know
    // how tall the content is.
    const next = Math.max(0, scrollOffset.value + delta);
    listRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [activeIndex, containerHeight, hoverScreenY, pitch, scrollOffset]);

  /** Only ever called from a gesture that actually picked a row up. */
  const begin = useCallback(
    (index: number) => {
      settled.current = false;
      if (settleTimer.current !== null) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      stopAutoScroll();
      setDragging(true);
      setLifted(index);
      autoScrollTimer.current = setInterval(
        autoScrollTick,
        AUTO_SCROLL_INTERVAL_MS,
      );
    },
    [autoScrollTick, stopAutoScroll],
  );

  /**
   * The finger is up. Scrolling comes back *here*, not when the animation
   * finishes: a list that cannot scroll is the one failure this design must
   * not have, whatever happens to the settle afterwards.
   */
  const release = useCallback(
    (from: number, to: number) => {
      stopAutoScroll();
      setDragging(false);
      if (settleTimer.current !== null) {
        clearTimeout(settleTimer.current);
      }
      // The animation normally reports back first and cancels this; it exists
      // only so that a settle that never arrives cannot leave the row lifted
      // and the reorder unwritten.
      settleTimer.current = setTimeout(() => {
        settleTimer.current = null;
        settleRef.current(from, to);
      }, SETTLE_FALLBACK_MS);
    },
    [stopAutoScroll],
  );

  /** The row has landed: write the new order, then hand the shared state back. */
  const settle = useCallback(
    (from: number, to: number) => {
      if (settled.current) {
        return;
      }
      settled.current = true;
      if (settleTimer.current !== null) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      const verb = verbsRef.current[from];
      // Cleared on the next frame, once React has laid the new order out:
      // resetting it in the same tick would flash every row back to its old
      // offset for a frame, which is the jump this design exists to avoid.
      requestAnimationFrame(() => {
        owner.value = -1;
        activeIndex.value = -1;
        touchTranslate.value = 0;
        scrollStart.value = 0;
        setLifted(null);
      });
      if (verb) {
        onReorder(verb.id, to);
      }
    },
    [activeIndex, onReorder, owner, scrollStart, touchTranslate],
  );
  const settleRef = useRef(settle);
  settleRef.current = settle;

  /** A drag the system cancelled after the pick-up: put everything back. */
  const abort = useCallback(() => {
    stopAutoScroll();
    setDragging(false);
    setLifted(null);
  }, [stopAutoScroll]);

  useEffect(
    () => () => {
      stopAutoScroll();
      if (settleTimer.current !== null) {
        clearTimeout(settleTimer.current);
      }
    },
    [stopAutoScroll],
  );

  const shared = useMemo<DragShared>(
    () => ({
      activeIndex,
      spacerIndex,
      hoverTranslate,
      touchTranslate,
      pitch,
      scrollOffset,
      scrollStart,
      owner,
      begin,
      release,
      settle,
      abort,
    }),
    [
      abort,
      activeIndex,
      begin,
      hoverTranslate,
      owner,
      pitch,
      release,
      scrollOffset,
      scrollStart,
      settle,
      spacerIndex,
      touchTranslate,
    ],
  );

  const onRowLayout = useCallback(
    (height: number) => {
      // The first row to report defines the slot pitch the drag arithmetic
      // runs on; every row is the same card, so one measurement is enough.
      if (height > 0 && pitch.value <= 0) {
        pitch.value = height;
      }
    },
    [pitch],
  );

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollOffset.value = event.contentOffset.y;
  });

  return (
    <Animated.FlatList
      ref={listRef}
      data={verbs}
      keyExtractor={verb => verb.id}
      renderItem={({ item, index }) => (
        <DraggableRow
          verb={item}
          rowIndex={index}
          lifted={lifted === index}
          hint={hintOf(item) ?? undefined}
          reorderEnabled={reorderEnabled}
          onPress={() => onPressVerb(item)}
          onRowLayout={onRowLayout}
          shared={shared}
        />
      )}
      // Off for the length of a drag, so the scroll view cannot take the
      // pointer back from the row that is following the finger.
      scrollEnabled={!dragging}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      onLayout={event => {
        containerHeight.value = event.nativeEvent.layout.height;
      }}
      // Rows have to stay mounted both to be measured and to step aside when a
      // drag passes over them.
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={count === 0 ? styles.emptyWrap : undefined}
      ListEmptyComponent={empty}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

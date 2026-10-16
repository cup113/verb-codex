import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  useLongPressGesture,
} from 'react-native-gesture-handler';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { VerbRow } from './VerbRow';
import type { Verb } from '../types';

export type VerbListProps = {
  verbs: Verb[];
  empty: ReactElement;
  onPressVerb: (verb: Verb) => void;
  /** Ordering is the native affordance; the web twin accepts and ignores it. */
  onReorder: (verbId: string, toIndex: number) => void;
};

/**
 * Nothing, on purpose.
 *
 * React Native calls `onPress` on release after a hold unless a long-press
 * handler is set, so a row picked up and put straight back would open the
 * detail screen. The Pressable's own long press exists only to swallow that
 * press; the pick-up itself is the gesture below.
 */
const swallowed = () => {};

type DraggableRowProps = {
  verb: Verb;
  drag: () => void;
  isActive: boolean;
  onPress: () => void;
};

/**
 * One row, plus the gesture that picks it up.
 *
 * The pick-up is a gesture-handler long press rather than the Pressable's own
 * `onLongPress`, and that distinction is the whole point: Pressable cancels
 * its long-press timer only from the JS touch-move events it receives
 * (`Pressability.onResponderMove`), and under the draggable list's pan those
 * are not reliably delivered — so a swipe could mature the timer, pick a row
 * up mid-scroll and leave the list impossible to scroll. Gesture handler
 * enforces `maxDistance` inside the native handler, so a finger that travels
 * fails the gesture no matter what the JS side hears, and the list scrolls.
 */
function DraggableRow({ verb, drag, isActive, onPress }: DraggableRowProps) {
  // Stable identity (only `drag` can change, and the list hands out a stable
  // one) so the gesture is not re-registered on every row re-render.
  const config = useMemo(
    () => ({
      minDuration: 400,
      maxDistance: 10,
      // The callback sets React state in the list, so it runs on the JS thread.
      runOnJS: true,
      onActivate: drag,
    }),
    [drag],
  );
  const pickUp = useLongPressGesture(config);

  return (
    <GestureDetector gesture={pickUp}>
      <VerbRow
        verb={verb}
        dragging={isActive}
        onPress={onPress}
        onLongPress={swallowed}
      />
    </GestureDetector>
  );
}

/** Android and iOS: long press a row to move it. */
export function VerbList({
  verbs,
  empty,
  onPressVerb,
  onReorder,
}: VerbListProps) {
  return (
    <DraggableFlatList
      data={verbs}
      keyExtractor={verb => verb.id}
      // `to` indexes the reordered array, so that entry is the dragged one;
      // the store does the moving and writes it out immediately.
      onDragEnd={({ data, to }) => onReorder(data[to].id, to)}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={verbs.length === 0 ? styles.emptyWrap : undefined}
      ListEmptyComponent={empty}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator>
          <DraggableRow
            verb={item}
            drag={drag}
            isActive={isActive}
            onPress={() => onPressVerb(item)}
          />
        </ScaleDecorator>
      )}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

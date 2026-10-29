import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  DragEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { VerbRow, MARK_TEST_ID } from './VerbRow';
import { PICK_UP_HOLD_MS } from './holds';
import { insertionIndex } from '../domain/verbs';
import { colors } from '../theme';
import type { VerbListProps } from './VerbList';

/** Movement that cancels a pending hold: this was a tap, or a wobble. */
const HOLD_SLOP = 10;

/** Where the row would land: a hairline inside the row it sits against. */
const dropLine = (edge: 'top' | 'bottom') =>
  `inset 0 ${edge === 'top' ? '2px' : '-2px'} 0 0 ${colors.terracotta}`;

const DRAG_SOURCE: CSSProperties = {
  cursor: 'grab',
  // Selecting a row's text helps with neither the drag nor the press, and a
  // half-selected label fights both. The rule lives in web/app.css rather than
  // here: an inline `userSelect` is written without the `-webkit-` prefix,
  // which WebKit ignores, so on iOS the rows stayed selectable and a long press
  // selected text instead of arming anything.
};

/**
 * Web: the same list, reordered by holding a row and dragging it with the
 * mouse.
 *
 * The native twin gets its ordering from reanimated, whose worklet transform
 * has no place in the Vite pipeline (see docs/spike-web.md) — that is why the
 * long-press chain cannot be shared. This twin therefore reorders with the
 * browser's own drag and drop: no animation library, and no interference with
 * scrolling (the browser owns the gesture, including its edge auto-scroll).
 * The store call is the same `onReorder(verbId, toIndex)` the native list makes.
 *
 * A finger cannot do this — HTML5 drag and drop fires nothing for touch — so a
 * touch browser gets no hint and no reorder; ordering there stays the native
 * app's job, exactly as it was before.
 *
 * One difference from the native twin: holding a row and releasing it without
 * moving starts no drag (the browser is the one that lifts it, and it has not),
 * so that still opens the entry. Nothing was picked up, so nothing is put back.
 */
export function VerbList({
  verbs,
  empty,
  hintOf,
  reorderEnabled,
  onPressVerb,
  onToggleStar,
  onReorder,
}: VerbListProps) {
  // The row whose hold has matured: only it is draggable, and only until the
  // press ends.
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // The gap the row would drop into: 0 above the first row, `verbs.length`
  // below the last. Only the marker needs it — the drop itself recomputes.
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  // A held mark disables the list's scrolling for the same reason the native
  // one does: the scroll container would otherwise take the press away before
  // the two seconds are up.
  const [markHeld, setMarkHeld] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  /*
   * An armed row has to be disarmed by a release *anywhere*: the press can end
   * outside the row it started on, and React only delivers `pointerup` to the
   * element under the pointer. Leaving the row is not a release, though — it is
   * how a drag begins — so nothing here listens for `pointerleave`.
   *
   * Once the drag session starts the browser stops delivering pointer events,
   * so this listener is dropped while dragging and `dragend` ends it instead.
   */
  useEffect(() => {
    if (armedId === null || draggingId !== null) {
      return;
    }
    const release = () => setArmedId(null);
    document.addEventListener('pointerup', release);
    return () => document.removeEventListener('pointerup', release);
  }, [armedId, draggingId]);

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const clearDrag = () => {
    cancelHold();
    pressOrigin.current = null;
    setArmedId(null);
    setDraggingId(null);
    setDropSlot(null);
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    verbId: string,
  ) => {
    // The mark is a control of its own: a star hold there must not arm a drag at
    // 400ms, or the browser would lift the row mid-hold and the star would
    // never fire. React Native Web has no hitSlop and the pointerdown bubbles
    // up to this wrapper, so ask the DOM which element was hit.
    if (
      (event.target as Element | null)?.closest?.(
        `[data-testid="${MARK_TEST_ID}"]`,
      )
    ) {
      return;
    }
    // A filtered list is a subset of the group, not its arrangement: arming a
    // drag there would hand the drop to a slot that is not the one aimed at.
    if (!reorderEnabled) {
      return;
    }
    // Only a mouse or trackpad arms a drag; a finger gets the list's scrolling
    // and nothing else.
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    cancelHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setArmedId(verbId);
    }, PICK_UP_HOLD_MS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (holdTimer.current === null || pressOrigin.current === null) {
      return;
    }
    const travelled = Math.hypot(
      event.clientX - pressOrigin.current.x,
      event.clientY - pressOrigin.current.y,
    );
    if (travelled > HOLD_SLOP) {
      cancelHold();
    }
  };

  /** Which slot the pointer is over, from where it sits inside the row. */
  const slotAt = (event: DragEvent<HTMLDivElement>, index: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? index : index + 1;
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    verbId: string,
  ) => {
    // Firefox refuses to start a drag unless some data is set on it.
    event.dataTransfer.setData('text/plain', verbId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(verbId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (draggingId === null) {
      return;
    }
    // Without this the browser treats the row as a non-drop-target. Nothing is
    // dropped by accident: the only rows that accept a drop are rows of this
    // list, and only while one of its own rows is in flight.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const slot = slotAt(event, index);
    // `dragover` fires continuously; the same slot must not re-render the list.
    setDropSlot(previous => (previous === slot ? previous : slot));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const verbId = event.dataTransfer.getData('text/plain');
    // Read the slot off the same event rather than the state the marker used:
    // the two cannot disagree then, whatever order they were flushed in.
    const slot = slotAt(event, index);
    clearDrag();
    const from = verbs.findIndex(verb => verb.id === verbId);
    if (from === -1) {
      return;
    }
    onReorder(verbId, insertionIndex(from, slot));
  };

  return (
    <FlatList
      data={verbs}
      keyExtractor={verb => verb.id}
      // A held star must outlive the scroll container's own gesture; the native
      // list does the same (see VerbList).
      scrollEnabled={!markHeld}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={verbs.length === 0 ? styles.emptyWrap : undefined}
      ListEmptyComponent={empty}
      renderItem={({ item, index }) => {
        const isArmed = item.id === armedId;
        const isDragging = item.id === draggingId;
        // `top of row i` and `bottom of row i-1` are the same slot, so the gap
        // is painted once: above its row, except below the last one.
        const markAbove = dropSlot === index;
        const markBelow =
          dropSlot === verbs.length && index === verbs.length - 1;
        const wrapper: CSSProperties = {
          ...DRAG_SOURCE,
          opacity: isDragging ? 0.35 : 1,
          // Drawn inside the row, so the marker never moves the rows it sits
          // between.
          boxShadow: markAbove
            ? dropLine('top')
            : markBelow
            ? dropLine('bottom')
            : undefined,
        };
        return (
          <div
            // The row's own name, for the stylesheet that keeps a long press
            // from turning into a text selection: see web/app.css.
            className="verb-row"
            // Armed by the hold, not by the row being a row: see
            // PICK_UP_HOLD_MS. And never while the list is a filtered subset:
            // see reorderEnabled.
            draggable={isArmed && reorderEnabled}
            onPointerDown={event => handlePointerDown(event, item.id)}
            onPointerMove={handlePointerMove}
            // A release over the row itself; a release anywhere else is caught
            // by the document listener above.
            onPointerUp={clearDrag}
            onDragStart={event => handleDragStart(event, item.id)}
            onDragOver={event => handleDragOver(event, index)}
            onDrop={event => handleDrop(event, index)}
            // Fires on a cancelled drag too (Escape, or a drop outside the
            // list), which is the only cleanup those paths get.
            onDragEnd={clearDrag}
            style={wrapper}
          >
            <VerbRow
              verb={item}
              hint={hintOf(item) ?? undefined}
              // The hold that arms the drag is worth showing: this is the same
              // lifted edge the native row gets when it is picked up.
              dragging={isArmed || isDragging}
              onPress={() => onPressVerb(item)}
              onToggleStar={() => onToggleStar(item.id, !item.starred)}
              onStarHoldStart={() => setMarkHeld(true)}
              onStarHoldEnd={() => setMarkHeld(false)}
            />
          </div>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

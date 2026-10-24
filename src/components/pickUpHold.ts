/**
 * How long a row must be held before it can be picked up.
 *
 * One number read in three places, because it is one gesture seen from three
 * sides: the native list arms its `Gesture.Pan` after this hold, the web list
 * starts its own countdown before it lets a row be dragged, and the row's
 * `Pressable` uses it as `delayLongPress` — not to do anything, but to swallow
 * the release that would otherwise open the entry after a row was picked up and
 * put straight back. If those three ever disagreed, lifting a row and dropping
 * it in place would navigate.
 *
 * A hold, rather than a press, is what makes the list usable at all: a tap and
 * a drag begin with the same gesture on the same target, and a row that is
 * draggable from the start swallows the tap that opens an entry (measured on
 * the web: 2px of wobble, no navigation).
 */
export const PICK_UP_HOLD_MS = 400;

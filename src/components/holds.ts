/**
 * How long a row must be held before it can be picked up.
 *
 * One number read in three places, because it is one gesture seen from three
 * sides: the native list arms its `Gesture.Pan` after this hold, the web list
 * starts its own countdown before it lets a row be dragged, and the words'
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

/**
 * How long the mark at the end of a row must be held before the star is
 * written — or unwritten, on a starred entry.
 *
 * The mark is a touch target of its own, outside the pick-up gesture's view:
 * gesture-handler activates the drag at `PICK_UP_HOLD_MS`, and an active native
 * handler cancels the pressable's timer, so a 2s hold nested inside the drag
 * area would never mature. The two holds therefore never compete — the words
 * pick the row up, the mark marks it — which is also why the star's target is
 * the right-hand gutter (the mark and the ›) rather than the whole row.
 *
 * Two seconds is long enough to be unmistakably deliberate (a tap on the mark
 * still opens the entry) and short enough that a finger does not wander.
 */
export const STAR_HOLD_MS = 2000;

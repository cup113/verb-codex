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
 * handler cancels the pressable's timer, so a star hold nested inside the drag
 * area would never mature. The two holds therefore never compete — the words
 * pick the row up, the mark marks it — which is also why the star's target is
 * the right-hand gutter (the mark and the ›) rather than the whole row.
 *
 * 1.2 seconds is deliberate without being a patience test (a tap on the mark
 * still opens the entry) — and no hold at all is short enough for the
 * platform's own long press: both React Native and React Native Web cancel a
 * long press once the touch has travelled 10pt (see `STAR_HOLD_SLOP`), while
 * still treating the press as valid, so the release then opens the entry.
 * `VerbRow` therefore runs its own timer and measures drift itself.
 *
 * It shipped as two seconds in 0.7.0 and was shortened once held on a phone:
 * unmistakable turned out to mean "still waiting".
 */
export const STAR_HOLD_MS = 1200;

/**
 * How far a finger may drift while holding the mark, in points.
 *
 * The platform's built-in long press gives up at 10pt and cannot be tuned from
 * the props: React Native's `Pressability` cancels its timer past
 * `DEFAULT_LONG_PRESS_DEACTIVATION_DISTANCE` (10), and React Native Web hard-
 * codes the same `Math.hypot(...) > 10` in its responder — but neither cancels
 * the *press*, so a slipped hold still opens the entry on release. A finger
 * resting on a phone for the length of the hold moves further than that on
 * its own; with the built-in long press the star was a test of steadiness,
 * not a gesture.
 *
 * 30pt is about a thumb's unintended travel over the hold: forgiving of a
 * tremor, still smaller than a deliberate drag. Drift beyond it cancels the
 * hold *and* swallows the release, so a slipped finger neither stars nor jumps
 * into the entry by accident.
 */
export const STAR_HOLD_SLOP = 30;

/**
 * How far the list scrolls itself while a row is being dragged.
 *
 * Kept apart from the list because it is the one piece of the drag that is
 * plain arithmetic on the JS side (the tick that calls it runs on a timer, not
 * in a worklet), and because its sign is easy to get wrong in a way no manual
 * test would catch until it scrolled the wrong way.
 */

/** Distance from an edge at which the list starts scrolling itself. */
export const AUTO_SCROLL_EDGE = 48;
/** Pixels per tick at the very edge; it tapers to nothing at the threshold. */
export const AUTO_SCROLL_MAX_STEP = 10;

/**
 * The scroll step for a dragged row whose centre sits at `centre` on screen.
 *
 * Negative towards the top edge, positive towards the bottom one, `0` anywhere
 * in between. The magnitude grows linearly as the row gets closer to the edge,
 * so the list creeps at the threshold and moves at full speed once the row is
 * right against it.
 */
export function autoScrollStep(centre: number, height: number): number {
  const fromTop = centre;
  const fromBottom = height - centre;
  if (fromTop < AUTO_SCROLL_EDGE) {
    return (
      -AUTO_SCROLL_MAX_STEP * (1 - Math.max(0, fromTop) / AUTO_SCROLL_EDGE)
    );
  }
  if (fromBottom < AUTO_SCROLL_EDGE) {
    return (
      AUTO_SCROLL_MAX_STEP * (1 - Math.max(0, fromBottom) / AUTO_SCROLL_EDGE)
    );
  }
  return 0;
}

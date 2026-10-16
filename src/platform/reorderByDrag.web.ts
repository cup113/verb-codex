/**
 * Web: can this browser drag a row to reorder it?
 *
 * HTML5 drag and drop is a pointer-device interaction — it fires no events for
 * a finger on a touch screen. `hover: hover` + `pointer: fine` is the browser's
 * own statement that a mouse or trackpad is the primary pointing device, which
 * is exactly when the web list can honour a drag (a touchscreen laptop still
 * answers yes, because its primary pointer is the mouse).
 *
 * Read once at load: this only decides whether to advertise the gesture, and a
 * hint may lag a device that gained a mouse mid-session.
 */
export const reorderByDrag = window.matchMedia(
  '(hover: hover) and (pointer: fine)',
).matches;

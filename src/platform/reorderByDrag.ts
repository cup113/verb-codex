/**
 * Whether reordering happens by dragging a row with a pointer.
 *
 * Native never asks: the list reorders by long press there, so this seam only
 * exists to keep the shared call site honest about the web's answer.
 */
export const reorderByDrag = false;

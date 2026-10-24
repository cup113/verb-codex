import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a destructive question stays open after the first touch: long enough
 * to read it and answer, short enough that a stray touch never leaves one live
 * under the thumb.
 *
 * One number because it is one rule — the entry's « Supprimer » and the drill's
 * « Vider la Boîte » ask the same question in the same length.
 */
export const ARMED_MS = 3000;

export type ArmedConfirm = {
  /** True while the question is open. */
  armed: boolean;
  /** Ask on the first touch, act on the second. */
  press: () => void;
  /** Drop a question nobody answered, without doing anything. */
  disarm: () => void;
};

type Handlers = {
  onConfirm: () => void;
  onArm?: (() => void) | undefined;
};

/**
 * A destructive action asked for in place: no dialog laid over the thing being
 * deleted, two touches instead of one, and a question that withdraws itself if
 * it is never answered.
 *
 * The screen keeps what the question *says* — its word, its colour, where it
 * sits; when it expires, what a second touch does and that only one question is
 * ever open are the same in both places that ask, so they live here.
 */
export function useArmedConfirm(
  onConfirm: () => void,
  options: { onArm?: () => void } = {},
): ArmedConfirm {
  const [armed, setArmed] = useState(false);
  // Read by `press`, so that the arm and the withdraw below are the only two
  // writers and cannot disagree with the rendered flag.
  const armedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The callbacks close over the entry being deleted or the screen being left,
  // so the latest render's are the right ones — the timer's own closure must
  // never be the one that survives.
  const latest = useRef<Handlers>({ onConfirm, onArm: options.onArm });
  useEffect(() => {
    latest.current = { onConfirm, onArm: options.onArm };
  });

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const disarm = useCallback(() => {
    clear();
    armedRef.current = false;
    setArmed(false);
  }, [clear]);

  // Stable, so a caller can put it in a `useEffect`'s dependencies: a hardware
  // back handler that drops the question must not re-subscribe every render.
  const press = useCallback(() => {
    if (armedRef.current) {
      disarm();
      latest.current.onConfirm();
      return;
    }
    // One question at a time: arming one withdraws whatever else was open.
    latest.current.onArm?.();
    clear();
    armedRef.current = true;
    setArmed(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      armedRef.current = false;
      setArmed(false);
    }, ARMED_MS);
  }, [clear, disarm]);

  // A question must not outlive the screen that asked it: a timer still running
  // would fire a state update on a card that is already gone.
  useEffect(() => clear, [clear]);

  return { armed, press, disarm };
}

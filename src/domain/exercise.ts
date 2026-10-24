import { ROW_COUNT } from '../types';
import { checkPaper } from './dictation';
import type { CheckedRow } from './dictation';

/** The six recorded words a paper is graded against, in row order. */
export type Recorded = readonly string[];

/**
 * What a card is doing, as one value.
 *
 * The six rows themselves never move: only what they can do changes. The card
 * at rest is `null` — nothing is being practised, every row is readable and
 * editable — and each exercise is a value that replaces it wholesale, so
 * leaving an exercise is dropping the value rather than clearing four pieces
 * of state one by one. Nothing typed in a dictation is kept anywhere else: the
 * codex keeps recorded words, never attempts at them.
 */
export type Exercise = SelfTest | Dictation;

type SelfTest = {
  kind: 'selfTest';
  /** The rows the user has unmasked so far, by index. */
  revealed: ReadonlySet<number>;
};

type Dictation = {
  kind: 'dictation';
  /**
   * The recorded words the paper is graded against, read once when it starts.
   * The codex's own answer at the moment the exercise began — the paper does
   * not follow later edits, it is compared with what it was handed.
   */
  recorded: Recorded;
  /** One word per row, as the user has typed it so far. */
  typed: readonly string[];
  /** One verdict per row: `null` until a check has judged it. */
  verdicts: readonly CheckedRow[];
  /**
   * Whether the paper was flawless the first time it was checked. A round that
   * needed correcting keeps this false to the end, so its stamp is the lesser
   * one — see ADR 0002.
   */
  flawless: boolean;
};

/** A self-test with every row still masked. */
export function startSelfTest(): Exercise {
  return { kind: 'selfTest', revealed: new Set<number>() };
}

/**
 * Unmask one row. Asking again for a row already on show changes nothing.
 *
 * Self-test judges nothing: there is no verdict in this half of the value at
 * all, which is the rule stated as a type rather than as a promise.
 */
export function reveal(exercise: Exercise, index: number): Exercise {
  if (exercise.kind !== 'selfTest' || exercise.revealed.has(index)) {
    return exercise;
  }
  const revealed = new Set(exercise.revealed);
  revealed.add(index);
  return { kind: 'selfTest', revealed };
}

/** A blank paper for this card: six empty fields, nothing judged yet. */
export function startDictation(recorded: Recorded): Exercise {
  return {
    kind: 'dictation',
    recorded,
    typed: Array.from({ length: ROW_COUNT }, () => ''),
    verdicts: Array.from({ length: ROW_COUNT }, () => null),
    flawless: false,
  };
}

/**
 * Record one typed word, and withdraw the verdict of a row that came out wrong.
 *
 * Editing a crossed-out row withdraws its verdict, so the next check judges the
 * corrected word on its own and the strike goes with it. A row that came out
 * right keeps its verdict: it is read-only in the meantime, so it cannot have
 * changed. A paper that has already been stamped cannot be written to at all —
 * it is the record of a round that is over.
 */
export function write(
  exercise: Exercise,
  index: number,
  text: string,
): Exercise {
  if (exercise.kind !== 'dictation' || finishedOf(exercise)) {
    return exercise;
  }
  const typed = exercise.typed.map((word, i) => (i === index ? text : word));
  const verdicts = exercise.verdicts.map((verdict, i) =>
    i === index && verdict === 'bad' ? null : verdict,
  );
  if (
    sameList(typed, exercise.typed) &&
    sameList(verdicts, exercise.verdicts)
  ) {
    return exercise;
  }
  return { ...exercise, typed, verdicts };
}

/**
 * Grade the whole paper, as one press of « Vérifier » sees it.
 *
 * The grading itself is `checkPaper`'s; what this adds is where the answer
 * lands — the verdicts, and the one fact the stamp reads, which only the first
 * check of a round can earn.
 */
export function verify(exercise: Exercise): Exercise {
  if (exercise.kind !== 'dictation') {
    return exercise;
  }
  const result = checkPaper({
    inputs: exercise.typed,
    recorded: exercise.recorded,
    previous: exercise.verdicts,
  });
  // Pressing Vérifier again on a paper nobody touched is not a new round: it
  // returns the same value, so nothing downstream sees a change.
  if (
    sameList(result.verdicts, exercise.verdicts) &&
    result.flawless === exercise.flawless
  ) {
    return exercise;
  }
  return {
    ...exercise,
    verdicts: result.verdicts,
    flawless: result.flawless,
  };
}

/**
 * Whether the paper is finished: every row has been judged, and every one of
 * them matched. Read off the verdicts rather than stored beside them, so a
 * paper cannot say it is done while a crossed-out row is still on it.
 */
export function finishedOf(exercise: Exercise): boolean {
  return (
    exercise.kind === 'dictation' &&
    exercise.verdicts.length === ROW_COUNT &&
    exercise.verdicts.every(verdict => verdict === 'ok')
  );
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

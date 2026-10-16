import { ROW_COUNT } from '../types';

/** What one row's word came out as when the paper was checked. */
export type RowVerdict = 'ok' | 'bad';

/** One typed word per conjugation row, in the fixed row order. */
export type DictationInputs = readonly string[];

/** A row's verdict after a check; `null` while it has not been checked yet. */
export type CheckedRow = RowVerdict | null;

export type CheckResult = {
  verdicts: RowVerdict[];
  /**
   * Only ever true on the first check of a round. Correction is a lesser
   * exercise than recall, so the two earn different stamps — see ADR 0002.
   */
  flawless: boolean;
  /** Every row now matches; there is nothing left to correct. */
  done: boolean;
};

/**
 * Whether what the user wrote is the recorded word.
 *
 * Strictly: only leading and trailing whitespace is forgiven — that is the
 * keyboard's doing, never the user's spelling. Case and accents are the user's
 * own handwriting and count, because the whole form is the unit of comparison:
 * the codex never splits it into a stem and an ending, so it cannot tell the
 * user which letter was wrong either. The codex still knows no French; it only
 * compares the user's fresh word with the user's own recorded one.
 */
export function matchesRecorded(typed: string, recorded: string): boolean {
  return typed.trim() === recorded;
}

/** Whether this check is the round's first: nothing has been judged yet. */
export function isFirstCheck(previous: readonly CheckedRow[]): boolean {
  return previous.every(verdict => verdict === null);
}

/**
 * Grade one row, leaving a row that already earned `ok` alone.
 *
 * A verdict once earned is not re-litigated by the next check: the row is
 * locked and read-only in the meantime, so it cannot have changed.
 */
export function gradeRow(args: {
  input: string;
  recorded: string;
  previous: CheckedRow;
}): RowVerdict {
  if (args.previous === 'ok') {
    return 'ok';
  }
  return matchesRecorded(args.input, args.recorded) ? 'ok' : 'bad';
}

/**
 * The whole paper, as one press of « Vérifier » sees it.
 *
 * An empty field is simply wrong: there is nothing in it that matches. Every
 * row has a recorded word by the time the screen lets the user in (an
 * incomplete entry cannot start a dictation), so there is no blank-recording
 * case to answer for here.
 */
export function checkPaper(args: {
  inputs: DictationInputs;
  recorded: readonly string[];
  previous: readonly CheckedRow[];
}): CheckResult {
  const verdicts = args.recorded
    .slice(0, ROW_COUNT)
    .map((word, index) =>
      gradeRow({
        input: args.inputs[index] ?? '',
        recorded: word,
        previous: args.previous[index] ?? null,
      }),
    );
  const everyRowOk = verdicts.every(verdict => verdict === 'ok');
  return {
    verdicts,
    flawless: isFirstCheck(args.previous) && everyRowOk,
    done: everyRowOk,
  };
}

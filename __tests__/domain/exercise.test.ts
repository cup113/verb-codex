import {
  finishedOf,
  reveal,
  startDictation,
  startSelfTest,
  verify,
  write,
} from '../../src/domain/exercise';
import type { Exercise } from '../../src/domain/exercise';
import type { CheckedRow } from '../../src/domain/dictation';

/** The six words « aimer » records, in row order. */
const RECORDED = ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'];

/** The same paper with the second row slipped: « aime » where « aimes » is. */
const SLIPPED = ['aime', 'aime', 'aime', 'aimons', 'aimez', 'aiment'];

/** A blank dictation for the six recorded words above. */
function blank(): Exercise {
  return startDictation(RECORDED);
}

/** A blank dictation with `words` typed into it, in row order. */
function filled(words: readonly string[]): Exercise {
  return words.reduce(
    (paper, word, index) => write(paper, index, word),
    blank(),
  );
}

/** The words a paper now holds — the rule under test, read off the value. */
function typedIn(exercise: Exercise): readonly string[] {
  if (exercise.kind !== 'dictation') {
    throw new Error('not a dictation');
  }
  return exercise.typed;
}

/** The verdicts a paper now holds, `null` for a row nobody has judged. */
function verdictsIn(exercise: Exercise): readonly CheckedRow[] {
  if (exercise.kind !== 'dictation') {
    throw new Error('not a dictation');
  }
  return exercise.verdicts;
}

/** Whether the paper earned the flawless stamp, which only a first check can. */
function flawlessIn(exercise: Exercise): boolean {
  return exercise.kind === 'dictation' && exercise.flawless;
}

describe('a self-test', () => {
  it('starts with every row still masked', () => {
    const exercise = startSelfTest();

    expect(exercise.kind).toBe('selfTest');
    expect(exercise.kind === 'selfTest' && [...exercise.revealed]).toEqual([]);
  });

  it('unmasks one row at a time, keeping the ones already on show', () => {
    const exercise = reveal(reveal(startSelfTest(), 2), 4);

    expect(
      exercise.kind === 'selfTest' && [...exercise.revealed].sort(),
    ).toEqual([2, 4]);
  });

  it('changes nothing when a row already on show is asked for again', () => {
    const once = reveal(startSelfTest(), 1);

    expect(reveal(once, 1)).toBe(once);
  });

  it('judges nothing, because it holds no verdicts to judge with', () => {
    // The rule stated as a type: a self-test has no place to put a verdict.
    expect('verdicts' in startSelfTest()).toBe(false);
  });
});

describe('a dictation', () => {
  it('starts as a blank paper: six empty fields, nothing judged', () => {
    const paper = blank();

    expect(typedIn(paper)).toEqual(['', '', '', '', '', '']);
    expect(verdictsIn(paper)).toEqual([null, null, null, null, null, null]);
    expect(finishedOf(paper)).toBe(false);
  });

  it('records one word without touching the other five', () => {
    const paper = write(blank(), 4, 'allez');

    expect(typedIn(paper)).toEqual(['', '', '', '', 'allez', '']);
  });

  it('withdraws the verdict of the row being corrected, and only that row', () => {
    const checked = verify(filled(SLIPPED));
    expect(verdictsIn(checked)).toEqual(['ok', 'bad', 'ok', 'ok', 'ok', 'ok']);

    const corrected = write(checked, 1, 'aimes');

    // The strike goes with the verdict; the rows that came out right are not
    // re-litigated by another row's correction.
    expect(verdictsIn(corrected)).toEqual(['ok', null, 'ok', 'ok', 'ok', 'ok']);
    expect(typedIn(corrected)[1]).toBe('aimes');
  });

  it('keeps the verdict of a row that came out right, even when it is re-typed', () => {
    const checked = verify(filled(SLIPPED));

    const edited = write(checked, 0, 'aime');

    expect(verdictsIn(edited)[0]).toBe('ok');
  });

  it('cannot be written to once it has been stamped', () => {
    const stamped = verify(filled(RECORDED));
    expect(finishedOf(stamped)).toBe(true);

    // The round is over: the paper is the record of it, not a draft.
    expect(write(stamped, 0, 'autre')).toBe(stamped);
  });

  it('is left alone by a gesture that belongs to the other exercise', () => {
    const paper = blank();
    const exercise = startSelfTest();

    expect(reveal(paper, 0)).toBe(paper);
    expect(write(exercise, 0, 'aime')).toBe(exercise);
  });

  it('grades nothing while the card is only being read', () => {
    const exercise = startSelfTest();

    expect(verify(exercise)).toBe(exercise);
  });
});

describe('checking a paper', () => {
  it('stamps a first check that found nothing wrong', () => {
    const checked = verify(filled(RECORDED));

    expect(verdictsIn(checked)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    expect(finishedOf(checked)).toBe(true);
    expect(flawlessIn(checked)).toBe(true);
  });

  it('finishes a corrected paper with the lesser stamp', () => {
    const first = verify(filled(SLIPPED));
    expect(finishedOf(first)).toBe(false);

    const corrected = verify(write(first, 1, 'aimes'));

    expect(finishedOf(corrected)).toBe(true);
    // Correction is a lesser exercise than recall — see ADR 0002.
    expect(flawlessIn(corrected)).toBe(false);
  });

  it('is the same value when the paper it checks has not changed', () => {
    const first = verify(filled(SLIPPED));

    expect(verify(first)).toBe(first);
  });

  it('is the same blank paper when nothing has been typed yet', () => {
    const paper = blank();
    const checked = verify(paper);

    expect(verdictsIn(checked)).toEqual([
      'bad',
      'bad',
      'bad',
      'bad',
      'bad',
      'bad',
    ]);
    expect(verify(checked)).toBe(checked);
  });
});

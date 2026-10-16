import {
  checkPaper,
  gradeRow,
  isFirstCheck,
  matchesRecorded,
} from '../../src/domain/dictation';
import type { CheckedRow } from '../../src/domain/dictation';

/** The seed entry's six recorded words, as the app ships them. */
const RECORDED = ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'];
const UNCHECKED: CheckedRow[] = [null, null, null, null, null, null];

describe('matchesRecorded', () => {
  it('takes the recorded word as the only standard', () => {
    expect(matchesRecorded('aime', 'aime')).toBe(true);
    expect(matchesRecorded('aimons', 'aime')).toBe(false);
  });

  it('forgives the whitespace a keyboard leaves behind, and nothing else', () => {
    expect(matchesRecorded('  aime ', 'aime')).toBe(true);
    expect(matchesRecorded('aim e', 'aime')).toBe(false);
  });

  it('counts an accent: it is the user writing, not the keyboard', () => {
    // Stricter than search, which folds accents because it is only looking for
    // a word. Dictation is reproducing one, and the accent is the exercise.
    expect(matchesRecorded('prefere', 'préfère')).toBe(false);
    expect(matchesRecorded('préfère', 'préfère')).toBe(true);
  });

  it('counts case too — same reason', () => {
    expect(matchesRecorded('Aime', 'aime')).toBe(false);
  });

  it('finds nothing to match in an empty field', () => {
    expect(matchesRecorded('', 'aime')).toBe(false);
    expect(matchesRecorded('   ', 'aime')).toBe(false);
  });
});

describe('isFirstCheck', () => {
  it('is true only while nothing on the paper has been judged', () => {
    expect(isFirstCheck(UNCHECKED)).toBe(true);
    expect(isFirstCheck(['ok', null, null, null, null, null])).toBe(false);
    expect(isFirstCheck(['bad', null, null, null, null, null])).toBe(false);
  });
});

describe('gradeRow', () => {
  it('leaves a verdict already earned alone', () => {
    // A row that came out right is locked and read-only in the meantime, so a
    // later check has nothing new to say about it.
    expect(
      gradeRow({ input: 'wrong', recorded: 'aime', previous: 'ok' }),
    ).toBe('ok');
  });

  it('judges a struck row afresh once the user has changed it', () => {
    expect(
      gradeRow({ input: 'aimes', recorded: 'aimes', previous: 'bad' }),
    ).toBe('ok');
  });
});

describe('checkPaper', () => {
  it('grades all six rows against their recorded words', () => {
    const result = checkPaper({
      inputs: ['aime', 'aime', 'aime', 'aimon', 'aimez', ''],
      recorded: RECORDED,
      previous: UNCHECKED,
    });

    expect(result.verdicts).toEqual(['ok', 'bad', 'ok', 'bad', 'ok', 'bad']);
    expect(result.done).toBe(false);
    expect(result.flawless).toBe(false);
  });

  it('calls a paper that was right the first time flawless', () => {
    const result = checkPaper({
      inputs: RECORDED,
      recorded: RECORDED,
      previous: UNCHECKED,
    });

    expect(result.verdicts.every(verdict => verdict === 'ok')).toBe(true);
    expect(result.done).toBe(true);
    expect(result.flawless).toBe(true);
  });

  it('never calls a corrected paper flawless, however clean it ends up', () => {
    const first = checkPaper({
      inputs: ['aime', 'aime', 'aime', 'aimons', 'aimez', 'aiment'],
      recorded: RECORDED,
      previous: UNCHECKED,
    });
    expect(first.flawless).toBe(false);
    expect(first.done).toBe(false);

    // The user corrects the one fault and hands the same paper back.
    const second = checkPaper({
      inputs: RECORDED,
      recorded: RECORDED,
      previous: first.verdicts,
    });
    expect(second.verdicts.every(verdict => verdict === 'ok')).toBe(true);
    expect(second.done).toBe(true);
    expect(second.flawless).toBe(false);
  });

  it('keeps a row that is already inked inked', () => {
    // Nothing in the interface can empty a settled row — it is read-only — but
    // the verdict belongs to the paper, not to the field that earned it.
    const result = checkPaper({
      inputs: ['', '', '', '', '', ''],
      recorded: RECORDED,
      previous: ['ok', null, null, null, null, null],
    });

    expect(result.verdicts[0]).toBe('ok');
    expect(result.verdicts.slice(1)).toEqual(['bad', 'bad', 'bad', 'bad', 'bad']);
  });

  it('treats an empty field as a fault with nothing in it', () => {
    const result = checkPaper({
      inputs: ['', '', '', '', '', ''],
      recorded: RECORDED,
      previous: UNCHECKED,
    });

    expect(result.done).toBe(false);
    expect(result.verdicts.filter(verdict => verdict === 'bad')).toHaveLength(6);
  });
});

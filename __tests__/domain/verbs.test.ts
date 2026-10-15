import {
  createVerb,
  emptyRows,
  filledCount,
  nextVerbId,
  parseVerbs,
  withInfinitive,
  withRow,
} from '../../src/domain/verbs';
import { PRONOUNS, ROW_COUNT, pronounFor } from '../../src/types';

const NOW = 1_700_000_000_000;

describe('createVerb', () => {
  it('starts every entry with six blank rows', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: '  aimer  ',
      group: 1,
      now: NOW,
    });

    expect(verb.rows).toHaveLength(ROW_COUNT);
    expect(verb.rows).toEqual(emptyRows());
    expect(verb.infinitive).toBe('aimer');
    expect(verb.group).toBe(1);
    expect(verb.tense).toBe('present');
    expect(verb.createdAt).toBe(NOW);
  });
});

describe('filledCount', () => {
  it('counts a row once anything at all is recorded in it', () => {
    let verb = createVerb({
      id: 'v1',
      infinitive: 'aller',
      group: 3,
      now: NOW,
    });
    expect(filledCount(verb)).toBe(0);

    verb = withRow(verb, 0, { ending: 'vais' }, NOW + 1);
    verb = withRow(verb, 3, { stem: 'all' }, NOW + 2);

    expect(filledCount(verb)).toBe(2);
  });
});

describe('withRow', () => {
  it('replaces one row without touching the others', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'aimer',
      group: 1,
      now: NOW,
    });
    const next = withRow(verb, 2, { stem: 'aim', ending: 'e' }, NOW + 5);

    expect(next.rows[2]).toEqual({ stem: 'aim', ending: 'e' });
    expect(next.rows[0]).toEqual({ stem: '', ending: '' });
    expect(next.updatedAt).toBe(NOW + 5);
    // Immutable: the previous entry is intact.
    expect(verb.rows[2]).toEqual({ stem: '', ending: '' });
  });

  it('merges a partial patch instead of blanking the other half', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'finir',
      group: 2,
      now: NOW,
    });
    const typed = withRow(verb, 0, { stem: 'fin' }, NOW + 1);
    const ended = withRow(typed, 0, { ending: 'is' }, NOW + 2);

    expect(ended.rows[0]).toEqual({ stem: 'fin', ending: 'is' });
  });
});

describe('withInfinitive', () => {
  it('keeps the typed infinitive verbatim', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'aimer',
      group: 1,
      now: NOW,
    });
    expect(withInfinitive(verb, 'aim', NOW + 1).infinitive).toBe('aim');
  });
});

describe('nextVerbId', () => {
  it('is unique for the same timestamp', () => {
    const ids = new Set([
      nextVerbId(NOW, 0.1),
      nextVerbId(NOW, 0.2),
      nextVerbId(NOW, 0.9),
    ]);
    expect(ids.size).toBe(3);
  });
});

describe('pronounFor', () => {
  it('elides the first person before a vowel or a mute h', () => {
    expect(pronounFor(0, 'aim')).toBe("j'");
    expect(pronounFor(0, 'habite')).toBe("j'");
    expect(pronounFor(0, '')).toBe('je');
  });

  it('keeps "je" before a consonant', () => {
    expect(pronounFor(0, 'fin')).toBe('je');
    expect(pronounFor(0, '  vais')).toBe('je');
  });

  it('never elides the other five rows', () => {
    PRONOUNS.forEach((pronoun, index) => {
      if (index === 0) {
        return;
      }
      expect(pronounFor(index, 'aim')).toBe(pronoun);
      expect(pronounFor(index, 'fin')).toBe(pronoun);
    });
  });
});

describe('parseVerbs', () => {
  it('reads back what was written', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'aimer',
      group: 1,
      now: NOW,
    });
    const stored = JSON.stringify([
      withRow(verb, 0, { stem: 'aim', ending: 'e' }, NOW),
    ]);

    expect(parseVerbs(stored)).toEqual([
      {
        ...verb,
        rows: withRow(verb, 0, { stem: 'aim', ending: 'e' }, NOW).rows,
        updatedAt: NOW,
      },
    ]);
  });

  it('returns nothing rather than throwing on damaged payloads', () => {
    expect(parseVerbs(null)).toEqual([]);
    expect(parseVerbs('')).toEqual([]);
    expect(parseVerbs('{not json')).toEqual([]);
    expect(parseVerbs('{"verbs":[]}')).toEqual([]);
  });

  it('keeps the readable entries and repairs the rest', () => {
    const payload = JSON.stringify([
      {
        id: 'a',
        infinitive: 'aimer',
        group: 1,
        rows: [{ stem: 'aim', ending: 'e' }],
      },
      { infinitive: 'no id' },
      'nonsense',
      { id: 'b', infinitive: 'aller', group: 9, rows: 'broken' },
    ]);

    const verbs = parseVerbs(payload);

    expect(verbs.map(verb => verb.id)).toEqual(['a', 'b']);
    // Missing rows are padded back to six, and an out-of-range group is clamped.
    expect(verbs[0].rows).toHaveLength(ROW_COUNT);
    expect(verbs[0].rows[0]).toEqual({ stem: 'aim', ending: 'e' });
    expect(verbs[0].rows[1]).toEqual({ stem: '', ending: '' });
    expect(verbs[1].group).toBe(1);
    expect(verbs[1].rows).toEqual(emptyRows());
  });
});

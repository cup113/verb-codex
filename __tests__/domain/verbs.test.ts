import {
  createVerb,
  emptyRows,
  filledCount,
  insertionIndex,
  isComplete,
  nextVerbId,
  parseVerbs,
  reorderWithinGroup,
  withInfinitive,
  withNote,
  withRow,
} from '../../src/domain/verbs';
import { PRONOUNS, ROW_COUNT, pronounFor } from '../../src/types';

const NOW = 1_700_000_000_000;

describe('reorderWithinGroup', () => {
  const aimer = createVerb({
    id: 'a',
    infinitive: 'aimer',
    group: 1,
    now: NOW,
  });
  const parler = createVerb({
    id: 'b',
    infinitive: 'parler',
    group: 1,
    now: NOW,
  });
  const chanter = createVerb({
    id: 'c',
    infinitive: 'chanter',
    group: 1,
    now: NOW,
  });
  const finir = createVerb({
    id: 'z',
    infinitive: 'finir',
    group: 2,
    now: NOW,
  });

  const ids = (verbs: ReturnType<typeof reorderWithinGroup>) =>
    verbs.map(verb => verb.id);

  it('moves an entry within its own group', () => {
    expect(
      ids(reorderWithinGroup([aimer, parler, chanter, finir], 'a', 2)),
    ).toEqual(['b', 'c', 'a', 'z']);
  });

  it('leaves other groups in the array slots they already occupy', () => {
    expect(
      ids(reorderWithinGroup([aimer, finir, parler, chanter], 'c', 0)),
    ).toEqual(['c', 'z', 'a', 'b']);
  });

  it('clamps a target past the end of the group', () => {
    expect(ids(reorderWithinGroup([aimer, parler, chanter], 'a', 99))).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('returns the very same array when nothing would change', () => {
    const verbs = [aimer, parler, chanter];
    expect(reorderWithinGroup(verbs, 'b', 1)).toBe(verbs);
    expect(reorderWithinGroup(verbs, 'nope', 0)).toBe(verbs);
  });

  it('moves entries, it does not rewrite them', () => {
    const moved = reorderWithinGroup([aimer, parler], 'a', 1);

    expect(moved[0]).toBe(parler);
    expect(moved[1]).toBe(aimer);
    expect(moved[1].updatedAt).toBe(aimer.updatedAt);
  });
});

/**
 * The web list drags rows itself, so it computes its own `toIndex` from the gap
 * the pointer was over. These cases pin that arithmetic to the store's move:
 * a drop is a gap, but the dragged entry is lifted out of the list first, so
 * every gap below it is one slot further up by the time it lands.
 */
describe('insertionIndex', () => {
  const entries = ['a', 'b', 'c'].map(id =>
    createVerb({ id, infinitive: id, group: 1, now: NOW }),
  );
  const ids = (verbs: ReturnType<typeof reorderWithinGroup>) =>
    verbs.map(verb => verb.id);

  it('reads a slot as a gap, not as a destination', () => {
    // The gap below `c` (slot 3, above no row): `a` lands last, not past it.
    expect(insertionIndex(0, 3)).toBe(2);
    // Both faces of `b`'s own gap leave `b` where it is.
    expect(insertionIndex(1, 1)).toBe(1);
    expect(insertionIndex(1, 2)).toBe(1);
    // The ends of the list.
    expect(insertionIndex(2, 0)).toBe(0);
    expect(insertionIndex(0, 0)).toBe(0);
  });

  it('lands the entry in the gap it was dropped into, from every row', () => {
    // slot 0 is above `a`, 1 between `a` and `b`, 2 between `b` and `c`, 3 below `c`.
    const expected: Record<string, string[]> = {
      '0,0': ['a', 'b', 'c'],
      '0,1': ['a', 'b', 'c'],
      '0,2': ['b', 'a', 'c'],
      '0,3': ['b', 'c', 'a'],
      '1,0': ['b', 'a', 'c'],
      '1,1': ['a', 'b', 'c'],
      '1,2': ['a', 'b', 'c'],
      '1,3': ['a', 'c', 'b'],
      '2,0': ['c', 'a', 'b'],
      '2,1': ['a', 'c', 'b'],
      '2,2': ['a', 'b', 'c'],
      '2,3': ['a', 'b', 'c'],
    };

    Object.entries(expected).forEach(([dropped, order]) => {
      const [from, slot] = dropped.split(',').map(Number);
      const moved = reorderWithinGroup(
        entries,
        entries[from].id,
        insertionIndex(from, slot),
      );
      expect(ids(moved)).toEqual(order);
    });
  });
});

describe('notes', () => {
  it('starts empty, so recording one is always an explicit act', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'aimer',
      group: 1,
      now: NOW,
    });
    expect(verb.note).toBe('');
  });

  it('replaces the note, stamps the update, and leaves the original alone', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'aimer',
      group: 1,
      now: NOW,
    });
    const noted = withNote(verb, 'je / tu / il → -e', NOW + 5);

    expect(noted.note).toBe('je / tu / il → -e');
    expect(noted.updatedAt).toBe(NOW + 5);
    expect(verb.note).toBe('');
  });

  it('loads entries that were recorded before notes existed', () => {
    const legacy = JSON.stringify([
      {
        id: 'old',
        infinitive: 'aimer',
        group: 1,
        rows: [{ stem: 'aim', ending: 'e' }],
      },
    ]);

    const [verb] = parseVerbs(legacy);

    expect(verb.note).toBe('');
    expect(verb.rows).toHaveLength(ROW_COUNT);
    expect(verb.rows[0]).toEqual({ form: 'aime' });
  });

  it('keeps a recorded note verbatim, accents and all', () => {
    const kept = JSON.stringify([
      {
        id: 'n1',
        infinitive: 'aimer',
        group: 1,
        note: 'prononciation : èmé',
        rows: [],
      },
    ]);
    expect(parseVerbs(kept)[0].note).toBe('prononciation : èmé');
  });
});

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
  it('counts a row once a form is recorded in it', () => {
    let verb = createVerb({
      id: 'v1',
      infinitive: 'aller',
      group: 3,
      now: NOW,
    });
    expect(filledCount(verb)).toBe(0);

    verb = withRow(verb, 0, { form: 'vais' }, NOW + 1);
    verb = withRow(verb, 3, { form: 'allons' }, NOW + 2);

    expect(filledCount(verb)).toBe(2);
  });

  it('counts nothing for a form that holds only whitespace', () => {
    const verb = withRow(
      createVerb({ id: 'v1', infinitive: 'aimer', group: 1, now: NOW }),
      0,
      { form: '   ' },
      NOW + 1,
    );

    expect(filledCount(verb)).toBe(0);
  });
});

describe('isComplete', () => {
  it('is true only once every one of the six rows is written', () => {
    const empty = createVerb({ id: 'v1', infinitive: 'aimer', group: 1, now: NOW });
    expect(isComplete(empty)).toBe(false);

    const five = [0, 1, 2, 3, 4].reduce(
      (verb, index) => withRow(verb, index, { form: 'aime' }, NOW + index),
      empty,
    );
    expect(isComplete(five)).toBe(false);

    const six = withRow(five, 5, { form: 'aiment' }, NOW + 5);
    expect(isComplete(six)).toBe(true);
  });

  it('does not count a row holding only whitespace', () => {
    const empty = createVerb({ id: 'v1', infinitive: 'aimer', group: 1, now: NOW });
    const fiveAndABlank = [0, 1, 2, 3, 4].reduce(
      (verb, index) => withRow(verb, index, { form: 'aime' }, NOW + index),
      empty,
    );
    const blanked = withRow(fiveAndABlank, 5, { form: '  ' }, NOW + 5);

    expect(isComplete(blanked)).toBe(false);
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
    const next = withRow(verb, 2, { form: 'aime' }, NOW + 5);

    expect(next.rows[2]).toEqual({ form: 'aime' });
    expect(next.rows[0]).toEqual({ form: '' });
    expect(next.updatedAt).toBe(NOW + 5);
    // Immutable: the previous entry is intact.
    expect(verb.rows[2]).toEqual({ form: '' });
  });

  it('leaves the rows it was not asked about exactly as they were', () => {
    const verb = createVerb({
      id: 'v1',
      infinitive: 'finir',
      group: 2,
      now: NOW,
    });
    const first = withRow(verb, 0, { form: 'finis' }, NOW + 1);
    const second = withRow(first, 1, { form: 'finis' }, NOW + 2);

    expect(second.rows[0]).toEqual({ form: 'finis' });
    expect(second.rows[1]).toEqual({ form: 'finis' });
    expect(second.rows[2]).toEqual({ form: '' });
    expect(first.rows[1]).toEqual({ form: '' });
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
    expect(pronounFor(0, 'aime')).toBe("j'");
    expect(pronounFor(0, 'habite')).toBe("j'");
    expect(pronounFor(0, '')).toBe('je');
  });

  it('elides a bare form the user recorded with no stem at all', () => {
    // The whole word is the record — "avoir" is written as the bare "ai".
    expect(pronounFor(0, 'ai')).toBe("j'");
    expect(pronounFor(0, '  ai')).toBe("j'");
    expect(pronounFor(0, 'suis')).toBe('je');
  });

  it('keeps "je" before a consonant', () => {
    expect(pronounFor(0, 'finis')).toBe('je');
    expect(pronounFor(0, '  vais')).toBe('je');
  });

  it('never elides the other five rows', () => {
    PRONOUNS.forEach((pronoun, index) => {
      if (index === 0) {
        return;
      }
      expect(pronounFor(index, 'aime')).toBe(pronoun);
      expect(pronounFor(index, 'finis')).toBe(pronoun);
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
    const stored = JSON.stringify([withRow(verb, 0, { form: 'aime' }, NOW)]);

    expect(parseVerbs(stored)).toEqual([
      {
        ...verb,
        rows: withRow(verb, 0, { form: 'aime' }, NOW).rows,
        updatedAt: NOW,
      },
    ]);
  });

  it('joins the halves of rows written before the whole-word model', () => {
    // The shape the app wrote up to v0.2.0: each row a stem plus an ending.
    // Reading it back must hand the user the word they typed, not six blanks.
    const legacy = JSON.stringify([
      {
        id: 'a',
        infinitive: 'aimer',
        group: 1,
        rows: [
          { stem: 'aim', ending: 'e' },
          { stem: '', ending: 'vais' },
          { stem: 'vend', ending: '' },
        ],
      },
    ]);

    const [verb] = parseVerbs(legacy);

    expect(verb.rows[0]).toEqual({ form: 'aime' });
    expect(verb.rows[1]).toEqual({ form: 'vais' });
    expect(verb.rows[2]).toEqual({ form: 'vend' });
    // Rows the old file never carried come back blank, still six of them.
    expect(verb.rows).toHaveLength(ROW_COUNT);
    expect(verb.rows[3]).toEqual({ form: '' });
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
        rows: [{ form: 'aime' }],
      },
      { infinitive: 'no id' },
      'nonsense',
      { id: 'b', infinitive: 'aller', group: 9, rows: 'broken' },
    ]);

    const verbs = parseVerbs(payload);

    expect(verbs.map(verb => verb.id)).toEqual(['a', 'b']);
    // Missing rows are padded back to six, and an out-of-range group is clamped.
    expect(verbs[0].rows).toHaveLength(ROW_COUNT);
    expect(verbs[0].rows[0]).toEqual({ form: 'aime' });
    expect(verbs[0].rows[1]).toEqual({ form: '' });
    expect(verbs[1].group).toBe(1);
    expect(verbs[1].rows).toEqual(emptyRows());
  });
});

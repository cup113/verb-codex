import {
  createVerb,
  emptyRows,
  filledCount,
  insertionIndex,
  nextVerbId,
  parseVerbs,
  reorderWithinGroup,
  sharedStem,
  withInfinitive,
  withNote,
  withRow,
  withSharedStem,
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

  it('counts nothing while the entry carries only its shared radical', () => {
    // The radical is written once for six rows, so "something is written"
    // would report a whole conjugation before a single ending exists.
    const verb = withSharedStem(
      createVerb({ id: 'v1', infinitive: 'aimer', group: 1, now: NOW }),
      'aim',
      NOW + 1,
    );

    expect(verb.rows.every(row => row.stem === 'aim')).toBe(true);
    expect(filledCount(verb)).toBe(0);
  });

  it('counts a row whose form is just its radical, once the entry has begun', () => {
    let verb = createVerb({
      id: 'v1',
      infinitive: 'vendre',
      group: 3,
      now: NOW,
    });
    verb = withSharedStem(verb, 'vend', NOW + 1);
    verb = withRow(verb, 0, { ending: 's' }, NOW + 2);
    verb = withRow(verb, 1, { ending: 's' }, NOW + 3);
    verb = withRow(verb, 3, { ending: 'ons' }, NOW + 4);
    verb = withRow(verb, 4, { ending: 'ez' }, NOW + 5);
    verb = withRow(verb, 5, { ending: 'ent' }, NOW + 6);

    // "il vend" is the radical itself: a blank ending is the record.
    expect(verb.rows[2]).toEqual({ stem: 'vend', ending: '' });
    expect(filledCount(verb)).toBe(6);
  });
});

describe('sharedStem', () => {
  it('reports the radical all six rows agree on', () => {
    const rows = emptyRows().map(row => ({ ...row, stem: 'aim' }));

    expect(sharedStem(rows)).toBe('aim');
  });

  it('reads six empty radicals as an agreed empty one', () => {
    // `aller` is recorded this way: no radical at all, whole words as endings.
    expect(sharedStem(emptyRows())).toBe('');
  });

  it('refuses to pick a value when the rows disagree', () => {
    const rows = emptyRows();
    rows[0] = { stem: 'v', ending: 'ais' };
    rows[5] = { stem: 'vont', ending: '' };

    expect(sharedStem(rows)).toBeNull();
  });
});

describe('withSharedStem', () => {
  it('writes one radical into all six rows and leaves the endings alone', () => {
    const recorded = withRow(
      createVerb({ id: 'v1', infinitive: 'aimer', group: 1, now: NOW }),
      0,
      { ending: 'e' },
      NOW + 1,
    );

    const next = withSharedStem(recorded, 'aim', NOW + 5);

    expect(next.rows.map(row => row.stem)).toEqual(
      Array(ROW_COUNT).fill('aim'),
    );
    expect(next.rows[0].ending).toBe('e');
    expect(next.updatedAt).toBe(NOW + 5);
    // Immutable: the entry it came from keeps its own rows.
    expect(recorded.rows[0]).toEqual({ stem: '', ending: 'e' });
  });

  it('overwrites a row that had recorded its own radical', () => {
    const own = withRow(
      createVerb({ id: 'v1', infinitive: 'aller', group: 3, now: NOW }),
      0,
      { stem: 'v', ending: 'ais' },
      NOW + 1,
    );

    const next = withSharedStem(own, '', NOW + 2);

    expect(next.rows[0]).toEqual({ stem: '', ending: 'ais' });
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

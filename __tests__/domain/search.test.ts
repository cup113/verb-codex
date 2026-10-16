import {
  findVerbs,
  foldQuery,
  foldWord,
  matchHint,
  matchesQuery,
} from '../../src/domain/search';
import { emptyRows } from '../../src/domain/verbs';
import { Verb } from '../../src/types';

/** One entry with the rows it was given, the rest blank. */
function entry(infinitive: string, forms: readonly string[], note = ''): Verb {
  const rows = emptyRows();
  forms.forEach((form, index) => {
    rows[index] = { form };
  });
  return {
    id: `v-${infinitive}`,
    infinitive,
    group: 1,
    tense: 'present',
    rows,
    note,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('foldWord', () => {
  it('drops every accent the French alphabet uses', () => {
    // Written as the groups the table folds them in, so the expectation reads
    // as the table does and a typo in either is visible.
    expect(foldWord('àâäçéèêëîïôöùûüÿœæ')).toBe(
      'aaac' + 'eeee' + 'ii' + 'oo' + 'uuu' + 'y' + 'oe' + 'ae',
    );
  });

  it('folds a word the user typed in capitals', () => {
    expect(foldWord('ÊTRE')).toBe('etre');
  });

  it('folds a whole sentence, and leaves everything else alone', () => {
    expect(foldWord("Être à l'école, sœur")).toBe("etre a l'ecole, soeur");
  });

  it('leaves an empty string empty', () => {
    expect(foldWord('')).toBe('');
  });
});

describe('foldQuery', () => {
  it('trims and folds what was typed', () => {
    expect(foldQuery('  Aimés  ')).toBe('aimes');
  });

  it('reads a query of nothing but spaces as no query', () => {
    expect(foldQuery('   ')).toBe('');
  });
});

describe('matchesQuery', () => {
  const finir = entry('finir', [
    'finis',
    'finis',
    'finit',
    'finissons',
    'finissez',
    'finissent',
  ]);

  it('matches from the headword, on any part of it', () => {
    expect(matchesQuery(finir, 'fin')).toBe(true);
    expect(matchesQuery(finir, foldQuery('FINIR'))).toBe(true);
  });

  it('matches a whole word recorded on one of the six lines', () => {
    expect(matchesQuery(finir, 'finiss')).toBe(true);
  });

  it('ignores accents in both directions', () => {
    const etre = entry('être', ['suis', 'es', 'est', 'sommes', 'êtes', 'sont']);

    expect(matchesQuery(etre, foldQuery('etre'))).toBe(true);
    expect(matchesQuery(etre, foldQuery('être'))).toBe(true);
    // The stored text stays exactly as the user wrote it.
    expect(etre.infinitive).toBe('être');
  });

  it('never matches from the note', () => {
    // The codex does not read the note, so it is not a way into an entry.
    const aime = entry('aimer', ['aime'], 'prononcé comme è');

    expect(matchesQuery(aime, foldQuery('prononce'))).toBe(false);
    expect(matchesQuery(aime, foldQuery('comme'))).toBe(false);
  });

  it('does not match what nobody wrote', () => {
    expect(matchesQuery(finir, 'chanter')).toBe(false);
  });

  it('treats an empty query as no query at all', () => {
    expect(matchesQuery(finir, '')).toBe(true);
  });
});

describe('matchHint', () => {
  const finir = entry('finir', [
    'finis',
    'finis',
    'finit',
    'finissons',
    'finissez',
    'finissent',
  ]);

  it('says nothing when the headword is what matched', () => {
    expect(matchHint(finir, foldQuery('finir'))).toBeNull();
  });

  it('names the pronoun and the whole word of the line that matched', () => {
    expect(matchHint(finir, foldQuery('finissons'))).toBe('nous finissons');
    expect(matchHint(finir, foldQuery('finit'))).toBe('il / elle finit');
  });

  it('takes the first line when several match', () => {
    // `finis` sits on both je and tu; the row shows one line, so it shows the
    // first.
    expect(matchHint(finir, foldQuery('finis'))).toBe('je finis');
  });

  it('elides the first person the way the notebook does', () => {
    const avoir = entry('avoir', ['ai', 'as', 'a', 'avons', 'avez', 'ont']);

    expect(matchHint(avoir, foldQuery('ai'))).toBe("j'ai");
  });

  it('says nothing when nothing matched', () => {
    expect(matchHint(finir, foldQuery('chanter'))).toBeNull();
    expect(matchHint(finir, '')).toBeNull();
  });
});

describe('findVerbs', () => {
  const aimer = entry('aimer', ['aime', 'aimes']);
  const aimable = entry('aimable', ['aimable']);
  const finir = entry('finir', ['finis']);

  it('hands the codex back in the order it was given', () => {
    // A subset of the user's own 次序 — never a ranking of the codex's own.
    expect(findVerbs([aimer, aimable, finir], 'ai').map(v => v.id)).toEqual([
      'v-aimer',
      'v-aimable',
    ]);
  });

  it('leaves the entries it was handed untouched', () => {
    const verbs = [aimer, finir];
    const found = findVerbs(verbs, 'finis');

    expect(found).toEqual([finir]);
    expect(verbs).toEqual([aimer, finir]);
  });

  it('returns everything for a query of nothing but spaces', () => {
    expect(findVerbs([aimer, finir], '   ')).toEqual([aimer, finir]);
  });
});

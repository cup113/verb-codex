import { ConjugationRow, Verb } from '../types';
import { emptyRows } from '../domain/verbs';

function rows(forms: readonly string[]): ConjugationRow[] {
  const filled = emptyRows();
  forms.forEach((form, index) => {
    filled[index] = { form };
  });
  return filled;
}

/**
 * The three verbs the demo card shows, so a first launch looks like the
 * notebook it was drawn from. Every row is plain recorded text: editing or
 * deleting them is the same as for any entry the user records.
 */
const SEED: readonly Verb[] = [
  {
    id: 'seed-aimer',
    infinitive: 'aimer',
    group: 1,
    tense: 'present',
    rows: rows(['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment']),
    note: '',
    starred: false,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-finir',
    infinitive: 'finir',
    group: 2,
    tense: 'present',
    rows: rows([
      'finis',
      'finis',
      'finit',
      'finissons',
      'finissez',
      'finissent',
    ]),
    note: '',
    starred: false,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-aller',
    infinitive: 'aller',
    group: 3,
    tense: 'present',
    rows: rows(['vais', 'vas', 'va', 'allons', 'allez', 'vont']),
    note: '',
    starred: false,
    createdAt: 0,
    updatedAt: 0,
  },
];

export function seedVerbs(): Verb[] {
  return SEED.map(verb => ({
    ...verb,
    rows: verb.rows.map(row => ({ ...row })),
  }));
}

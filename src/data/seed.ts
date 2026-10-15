import { ConjugationRow, Verb } from '../types';
import { emptyRows } from '../domain/verbs';

function rows(stem: string, endings: readonly string[]): ConjugationRow[] {
  const filled = emptyRows();
  endings.forEach((ending, index) => {
    filled[index] = { stem, ending };
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
    rows: rows('aim', ['e', 'es', 'e', 'ons', 'ez', 'ent']),
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-finir',
    infinitive: 'finir',
    group: 2,
    tense: 'present',
    rows: rows('fin', ['is', 'is', 'it', 'issons', 'issez', 'issent']),
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-aller',
    infinitive: 'aller',
    group: 3,
    tense: 'present',
    rows: rows('', ['vais', 'vas', 'va', 'allons', 'allez', 'vont']),
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

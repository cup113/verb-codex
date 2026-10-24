import { pronounFor } from './pronouns';
import { Verb } from '../types';

/**
 * The French letters folded to their unaccented twins, so a keyboard without
 * accents can still find what the user wrote down.
 *
 * An explicit table rather than `normalize('NFD')`: the folding has to come out
 * the same on Android, on the web and in Jest, and Unicode normalisation is a
 * runtime feature (Hermes builds it on ICU) that a memo has no reason to lean
 * on. The French alphabet is small enough to enumerate, and the table is the
 * whole of what this does.
 */
const FOLDED: Record<string, string> = {
  à: 'a',
  â: 'a',
  ä: 'a',
  ç: 'c',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  î: 'i',
  ï: 'i',
  ô: 'o',
  ö: 'o',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ÿ: 'y',
  œ: 'oe',
  æ: 'ae',
};

const ACCENTED = /[àâäçéèêëîïôöùûüÿœæ]/g;

/**
 * Fold recorded text for comparison: lower case, accents dropped.
 *
 * Only ever applied to a *copy*: the codex stores and shows the user's own
 * words exactly as written. Ignoring accents is a keyboard convenience in the
 * same family as the pronoun elision — not a judgement about French.
 */
export function foldWord(text: string): string {
  return text
    .toLowerCase()
    .replace(ACCENTED, letter => FOLDED[letter] ?? letter);
}

/** What the field was typed into, ready to compare. `''` means "no query". */
export function foldQuery(raw: string): string {
  return foldWord(raw.trim());
}

function holds(text: string, folded: string): boolean {
  return text !== '' && foldWord(text).includes(folded);
}

/**
 * Whether the entry's own words hold the query.
 *
 * Only the infinitive and the six whole words are searched: the note is free
 * prose the codex deliberately does not read, so it is never a way in. The
 * match is a plain substring of the folded copies — no tokenising, no typo
 * tolerance, no French.
 */
export function matchesQuery(verb: Verb, folded: string): boolean {
  if (folded === '') {
    return true;
  }
  return (
    holds(verb.infinitive, folded) ||
    verb.rows.some(row => holds(row.form, folded))
  );
}

/**
 * Why an entry is on the list, when the headword itself does not say it.
 *
 * `null` when the infinitive is the match — the row already shows it — and
 * otherwise the pronoun and whole word of the *first* line that matched, e.g.
 * `tu finis`. One line only, so the row keeps one shape.
 */
export function matchHint(verb: Verb, folded: string): string | null {
  if (folded === '' || holds(verb.infinitive, folded)) {
    return null;
  }
  const index = verb.rows.findIndex(row => holds(row.form, folded));
  if (index === -1) {
    return null;
  }
  const form = verb.rows[index].form;
  const pronoun = pronounFor(index, form);
  // The elided first person is one word: `j'ai`, not `j' ai`.
  return pronoun.endsWith("'") ? `${pronoun}${form}` : `${pronoun} ${form}`;
}

/**
 * The entries on show for what was typed, in the order they were handed over.
 *
 * `filter`, never `sort`: the result is a subset of the user's own 次序, and
 * the codex has no notion of relevance to rank by.
 */
export function findVerbs(verbs: readonly Verb[], raw: string): Verb[] {
  const folded = foldQuery(raw);
  if (folded === '') {
    return [...verbs];
  }
  return verbs.filter(verb => matchesQuery(verb, folded));
}

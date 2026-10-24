/**
 * The six rows' pronouns, and the one piece of French the display knows: which
 * of them elides before a vowel and which keeps its `e`.
 *
 * Elision is a display convenience only: the codex never judges French. A mute
 * "h" is elided, an aspirated one is not, and this heuristic cannot tell them
 * apart — the user's own recording stays untouched either way. That is also why
 * it lives here rather than in `types.ts`: it is the only behaviour in the
 * vocabulary, and it is this one.
 */

/** Fixed display order of the six conjugation rows. */
export const PRONOUNS = [
  'je',
  'tu',
  'il / elle',
  'nous',
  'vous',
  'ils / elles',
] as const;

const ELISION = /^[aàâäeéèêëiîïoôöuùûüœh]/i;

/**
 * The first letter the pronoun faces on screen: the row's recorded form. The
 * regex is anchored, so a blank row simply reads as "je".
 */
export function pronounFor(rowIndex: number, form: string): string {
  if (rowIndex !== 0) {
    return PRONOUNS[rowIndex] ?? '';
  }
  return ELISION.test(form.trim()) ? "j'" : 'je';
}

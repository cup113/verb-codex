export type Group = 1 | 2 | 3;

export type Tense = 'present';

export type ConjugationRow = {
  stem: string;
  ending: string;
};

export type Verb = {
  id: string;
  infinitive: string;
  group: Group;
  tense: Tense;
  rows: ConjugationRow[];
  /**
   * The user's own free-form annotation (pronunciation, usage, whatever they
   * want to remember). The codex never interprets it — like every other field,
   * it is recorded text and nothing more.
   */
  note: string;
  createdAt: number;
  updatedAt: number;
};

export const ROW_COUNT = 6;

export const GROUPS: readonly Group[] = [1, 2, 3];

/** Fixed display order of the six conjugation rows. */
export const PRONOUNS = [
  'je',
  'tu',
  'il / elle',
  'nous',
  'vous',
  'ils / elles',
] as const;

export const GROUP_LABELS: Record<Group, string> = {
  1: '1er Groupe (-er)',
  2: '2e (-ir)',
  3: '3e (Irrégulier)',
};

/** The index row has to hold all three at once, so it drops the word "Groupe". */
export const GROUP_TAB_LABELS: Record<Group, string> = {
  1: '1er (-er)',
  2: '2e (-ir)',
  3: '3e (Irrégulier)',
};

// Elision is a display convenience only: the codex never judges French. A mute
// "h" is elided, an aspirated one is not, and this heuristic cannot tell them
// apart — the user's own recording stays untouched either way.
const ELISION = /^[aàâäeéèêëiîïoôöuùûüœh]/i;

/**
 * The first letter the pronoun faces on screen: the stem's first letter, or —
 * when the stem is blank (aller is recorded as a bare ending, so is avoir's
 * "ai") — the ending's. The regex is anchored, so joining the two halves and
 * testing the result reads as exactly that.
 */
export function pronounFor(
  rowIndex: number,
  stem: string,
  ending: string,
): string {
  if (rowIndex !== 0) {
    return PRONOUNS[rowIndex] ?? '';
  }
  return ELISION.test(stem.trim() + ending.trim()) ? "j'" : 'je';
}

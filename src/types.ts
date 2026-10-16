export type Group = 1 | 2 | 3;

export type Tense = 'present';

export type ConjugationRow = {
  /**
   * The conjugated form the user records for this pronoun — the whole word,
   * exactly as written, in one piece.
   */
  form: string;
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

/**
 * What the way back is called: the group the entry belongs to, because that is
 * where the list was standing. Short on purpose — a back label is a signpost
 * at the edge of a header, not a caption, and the tabs already spell the group
 * out in full one screen earlier.
 */
export const GROUP_BACK_LABELS: Record<Group, string> = {
  1: '1er',
  2: '2e',
  3: '3e',
};

// Elision is a display convenience only: the codex never judges French. A mute
// "h" is elided, an aspirated one is not, and this heuristic cannot tell them
// apart — the user's own recording stays untouched either way.
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

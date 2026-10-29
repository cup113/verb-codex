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
  /**
   * The owner's own mark, written by hand on a complete entry. It is a recorded
   * value, not a fact read out of the rows: it survives the loss of a row (the
   * list just draws the completeness ring instead), and it travels with the
   * codex in a backup. See docs/adr/0004-star-mark-on-a-complete-entry.md.
   */
  starred: boolean;
  createdAt: number;
  updatedAt: number;
};

export const ROW_COUNT = 6;

export const GROUPS: readonly Group[] = [1, 2, 3];

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

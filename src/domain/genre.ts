/**
 * The gender drill's arithmetic: one le/la question per noun, and a four-box
 * Leitner ledger that decides what is due.
 *
 * This is the one place the codex carries French knowledge, and it is exactly
 * one bit per noun — the article its bank entry already carries (ADR 0003).
 * Nothing here judges a recorded value: the drill reads the bank's gender and
 * writes the boxes, and the boxes are the codex's own ledger, not a record.
 */

export type Gender = 'm' | 'f';

export type Noun = {
  /** The word as the bank spells it — `cœur`, not `coeur`. */
  w: string;
  g: Gender;
  /** Lexique 4.1 lemma frequency: the draw's only weighting. */
  f: number;
  /** The one-line Chinese gloss that lets the word be recognised. */
  zh: string;
};

export type Box = 1 | 2 | 3 | 4;

/** What a box remembers: the word, its gender, and when it is due again. */
export type ReviewItem = {
  w: string;
  g: Gender;
  box: Box;
  due: number;
};

export type ReviewState = {
  items: Readonly<Record<string, ReviewItem>>;
};

/** One sitting is twenty questions, drawn without replacement. */
export const SESSION_SIZE = 20;

const DAY_MS = 86_400_000;

/**
 * Days until a noun in this box comes up again. Box 1 is due at once, so the
 * errors of a sitting can be reviewed the same day; box 4 is the last, and a
 * right answer there graduates the noun out of the boxes.
 */
export const BOX_DAYS: Readonly<Record<Box, number>> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
};

export function emptyReview(): ReviewState {
  return { items: {} };
}

export function articleFor(gender: Gender): 'le' | 'la' {
  return gender === 'm' ? 'le' : 'la';
}

/**
 * Watch for a gender in which the question has one answer: a wrong `g` here
 * would make the drill unanswerable rather than merely wrong.
 */
function readItem(value: unknown): ReviewItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const { w, g, box, due } = candidate;
  if (typeof w !== 'string' || w === '') {
    return null;
  }
  if (g !== 'm' && g !== 'f') {
    return null;
  }
  if (typeof box !== 'number' || !Number.isInteger(box) || box < 1 || box > 4) {
    return null;
  }
  if (typeof due !== 'number' || !Number.isFinite(due)) {
    return null;
  }
  return { w, g, box: box as Box, due };
}

/**
 * Read the ledger, dropping what cannot be a question.
 *
 * A half-written value, a foreign key or a future format is not worth crashing
 * the drill over: entries are checked one by one, so one bad row costs that row
 * alone. Nothing here is a recorded value, so nothing here is irreplaceable.
 */
export function parseReview(raw: string | null): ReviewState {
  if (raw === null) {
    return emptyReview();
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyReview();
  }
  if (typeof data !== 'object' || data === null) {
    return emptyReview();
  }
  const items = (data as { items?: unknown }).items;
  if (typeof items !== 'object' || items === null) {
    return emptyReview();
  }
  const kept: Record<string, ReviewItem> = {};
  for (const value of Object.values(items as Record<string, unknown>)) {
    const item = readItem(value);
    if (item !== null) {
      kept[item.w] = item;
    }
  }
  return { items: kept };
}

export function serializeReview(state: ReviewState): string {
  // Versioned envelope like the codex's own backup: the shape may grow, and a
  // reader that meets a newer `v` can still read `items`.
  return JSON.stringify({ v: 1, items: state.items });
}

export function nextDue(box: Box, now: number): number {
  return now + BOX_DAYS[box] * DAY_MS;
}

/** Everything the ledger owes today, most overdue first. */
export function dueItems(state: ReviewState, now: number): ReviewItem[] {
  return Object.values(state.items)
    .filter(item => item.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function reviewCount(state: ReviewState, now: number): number {
  return dueItems(state, now).length;
}

/** How many nouns the ledger is holding, due or not. */
export function boxCount(state: ReviewState): number {
  return Object.keys(state.items).length;
}

/**
 * A wrong answer sends the noun back to box 1 — whether it arrived from the
 * bank or was halfway up the boxes.
 */
export function recordWrong(
  state: ReviewState,
  noun: { w: string; g: Gender },
  now: number,
): ReviewState {
  return {
    items: {
      ...state.items,
      [noun.w]: { w: noun.w, g: noun.g, box: 1, due: now },
    },
  };
}

export type RightOutcome =
  | { kind: 'none' }
  | { kind: 'graduated' }
  | { kind: 'advanced'; box: Box };

/**
 * What an answer did, in the only vocabulary the card needs: a wrong practice
 * answer has just joined the ledger, a wrong review answer has gone back to
 * box 1, a right review answer has moved up or graduated.
 */
export type AnswerOutcome =
  | { kind: 'toReview' }
  | { kind: 'sentBack' }
  | { kind: 'graduated' }
  | { kind: 'advanced'; box: Box };

/**
 * A right answer in a review moves the noun one box up; the fourth box is the
 * last, and answering right there graduates the noun out of the ledger.
 */
export function recordRight(
  state: ReviewState,
  noun: { w: string; g: Gender },
  now: number,
): { state: ReviewState; outcome: RightOutcome } {
  const item = state.items[noun.w];
  if (item === undefined) {
    return { state, outcome: { kind: 'none' } };
  }
  if (item.box >= 4) {
    const items = { ...state.items };
    delete items[noun.w];
    return { state: { items }, outcome: { kind: 'graduated' } };
  }
  const box = (item.box + 1) as Box;
  return {
    state: {
      items: { ...state.items, [noun.w]: { ...item, box, due: nextDue(box, now) } },
    },
    outcome: { kind: 'advanced', box },
  };
}

/**
 * Frequency-weighted draw without replacement.
 *
 * `sqrt(f)` keeps the top of the bank ahead of its tail without letting a
 * handful of very common nouns crowd out everything else. `rand` is a parameter
 * so tests can draw a fixed sitting; the caller passes `Math.random`.
 */
export function drawSession(
  bank: readonly Noun[],
  count: number,
  rand: () => number,
): Noun[] {
  const pool = bank.slice();
  const drawn: Noun[] = [];
  while (drawn.length < count && pool.length > 0) {
    let total = 0;
    const weights: number[] = [];
    for (const noun of pool) {
      const weight = Math.sqrt(noun.f);
      weights.push(weight);
      total += weight;
    }
    let cursor = rand() * total;
    let index = 0;
    while (index < pool.length && cursor >= weights[index]) {
      cursor -= weights[index];
      index += 1;
    }
    // A cursor that lands on the very end of the range (rand() === 1) belongs
    // to the last noun, not to no noun at all.
    if (index >= pool.length) {
      index = pool.length - 1;
    }
    drawn.push(pool.splice(index, 1)[0]);
  }
  return drawn;
}

/**
 * The bank by word. A review card carries only the word and its gender, so its
 * gloss has to be looked up: the ledger records what is due, not what it means.
 */
export function indexBank(bank: readonly Noun[]): ReadonlyMap<string, Noun> {
  return new Map(bank.map(noun => [noun.w, noun]));
}

import { ConjugationRow, Group, ROW_COUNT, Verb } from '../types';

export function emptyRows(): ConjugationRow[] {
  return Array.from({ length: ROW_COUNT }, () => ({ stem: '', ending: '' }));
}

export function createVerb(args: {
  id: string;
  infinitive: string;
  group: Group;
  now: number;
}): Verb {
  return {
    id: args.id,
    infinitive: args.infinitive.trim(),
    group: args.group,
    tense: 'present',
    rows: emptyRows(),
    note: '',
    createdAt: args.now,
    updatedAt: args.now,
  };
}

export function isRowFilled(row: ConjugationRow): boolean {
  return row.stem.trim() !== '' || row.ending.trim() !== '';
}

export function filledCount(verb: Verb): number {
  return verb.rows.filter(isRowFilled).length;
}

export function withRow(
  verb: Verb,
  index: number,
  patch: Partial<ConjugationRow>,
  now: number,
): Verb {
  return {
    ...verb,
    rows: verb.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    updatedAt: now,
  };
}

export function withInfinitive(
  verb: Verb,
  infinitive: string,
  now: number,
): Verb {
  return { ...verb, infinitive, updatedAt: now };
}

export function withNote(verb: Verb, note: string, now: number): Verb {
  return { ...verb, note, updatedAt: now };
}

/**
 * Move one entry to a new position among the entries of its own group.
 *
 * Order is per group: the list is filtered by group, so a group's members
 * swap among the array slots they already occupy and entries of other
 * groups keep theirs. Array position stays the single source of truth, so
 * there is no order field to keep in sync.
 */
export function reorderWithinGroup(
  verbs: Verb[],
  id: string,
  toIndex: number,
): Verb[] {
  const moving = verbs.find(verb => verb.id === id);
  if (!moving) {
    return verbs;
  }
  const inGroup = verbs.filter(verb => verb.group === moving.group);
  const from = inGroup.findIndex(verb => verb.id === id);
  const to = Math.max(0, Math.min(toIndex, inGroup.length - 1));
  if (from === to) {
    return verbs;
  }
  const reordered = [...inGroup];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  let next = 0;
  return verbs.map(verb =>
    verb.group === moving.group ? reordered[next++] : verb,
  );
}

/** Local-only identifier: collisions need uniqueness, not cryptography. */
export function nextVerbId(now: number, salt: number = Math.random()): string {
  return `v${now.toString(36)}${Math.floor(salt * 1e6).toString(36)}`;
}

/**
 * Tolerant reader for whatever is on disk: a damaged or partial payload must
 * never cost the user the entries that are still readable.
 */
export function parseVerbs(raw: string | null): Verb[] {
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(coerceVerb).filter((verb): verb is Verb => verb !== null);
}

export function coerceVerb(value: unknown): Verb | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id === '') {
    return null;
  }
  if (typeof candidate.infinitive !== 'string') {
    return null;
  }
  const group: Group =
    candidate.group === 1 || candidate.group === 2 || candidate.group === 3
      ? candidate.group
      : 1;
  const createdAt =
    typeof candidate.createdAt === 'number' ? candidate.createdAt : 0;
  return {
    id: candidate.id,
    infinitive: candidate.infinitive,
    group,
    tense: 'present',
    rows: coerceRows(candidate.rows),
    note: typeof candidate.note === 'string' ? candidate.note : '',
    createdAt,
    updatedAt:
      typeof candidate.updatedAt === 'number' ? candidate.updatedAt : createdAt,
  };
}

function coerceRows(value: unknown): ConjugationRow[] {
  const rows = emptyRows();
  if (!Array.isArray(value)) {
    return rows;
  }
  for (let i = 0; i < ROW_COUNT; i++) {
    const row = value[i];
    if (typeof row === 'object' && row !== null) {
      const candidate = row as Record<string, unknown>;
      rows[i] = {
        stem: typeof candidate.stem === 'string' ? candidate.stem : '',
        ending: typeof candidate.ending === 'string' ? candidate.ending : '',
      };
    }
  }
  return rows;
}

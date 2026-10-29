import { asyncStorageAdapter } from './asyncStorageAdapter';
import { createEnvelope, useEnvelope } from './envelope';
import { readItem } from './keyValueStorage';
import type { KeyValueStorage } from './keyValueStorage';
import { ConjugationRow, Group, Verb } from '../types';
import {
  createVerb,
  moveToGroup,
  nextVerbId,
  parseVerbs,
  reorderWithinGroup,
  starAndMove,
  withInfinitive,
  withNote,
  withRow,
} from '../domain/verbs';
import { seedVerbs } from '../data/seed';

export const VERBS_KEY = 'verbcodex.verbs.v1';
export const SEEDED_KEY = 'verbcodex.seeded.v1';
export const PERSIST_DEBOUNCE_MS = 300;

export type VerbState = {
  verbs: Verb[];
  ready: boolean;
};

export type VerbStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): VerbState;
  init(): Promise<void>;
  flush(): Promise<void>;
  addVerb(input: { infinitive: string; group: Group }): Promise<Verb>;
  setRow(verbId: string, index: number, patch: Partial<ConjugationRow>): void;
  setInfinitive(verbId: string, infinitive: string): void;
  setNote(verbId: string, note: string): void;
  /** Write or unwrite the owner's own mark on an entry. */
  setStarred(verbId: string, starred: boolean): Promise<void>;
  setGroup(verbId: string, group: Group): Promise<void>;
  reorderVerb(verbId: string, toIndex: number): Promise<void>;
  removeVerb(verbId: string): Promise<void>;
  replaceAll(verbs: Verb[]): Promise<void>;
};

export function createVerbStore(
  storage: KeyValueStorage,
  options: {
    seed?: () => Verb[];
    debounceMs?: number;
    now?: () => number;
    id?: (now: number) => string;
  } = {},
): VerbStore {
  const seed = options.seed ?? seedVerbs;
  const debounceMs = options.debounceMs ?? PERSIST_DEBOUNCE_MS;
  const now = options.now ?? Date.now;
  const makeId = options.id ?? ((timestamp: number) => nextVerbId(timestamp));

  let verbs: Verb[] = [];
  let ready = false;
  const envelope = createEnvelope<VerbState>(() => ({ verbs, ready }));

  // Structural edits are written straight away; keystrokes coalesce. A revision
  // counter (rather than a dirty flag) keeps that correct when a write is still
  // in flight while the user keeps typing.
  let revision = 0;
  let writtenRevision = -1;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function publish(): void {
    envelope.publish();
  }

  async function writeNow(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (revision === writtenRevision) {
      return;
    }
    const target = revision;
    const payload = JSON.stringify(verbs);
    try {
      await storage.setItem(VERBS_KEY, payload);
      writtenRevision = target;
    } catch {
      // Keep the codex usable in memory: a failed write retries on the next flush.
    }
  }

  function schedulePersist(): void {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      writeNow();
    }, debounceMs);
  }

  async function init(): Promise<void> {
    const raw = await readItem(storage, VERBS_KEY);
    const loaded = parseVerbs(raw);
    if (loaded.length > 0) {
      verbs = loaded;
    } else if (await seedAlreadyRan(storage)) {
      verbs = [];
    } else {
      verbs = seed();
      revision++;
      try {
        await storage.setItem(SEEDED_KEY, 'true');
      } catch {
        // Worst case the seed runs again next launch; never fatal.
      }
      await writeNow();
    }
    ready = true;
    publish();
  }

  async function addVerb(input: {
    infinitive: string;
    group: Group;
  }): Promise<Verb> {
    const timestamp = now();
    const verb = createVerb({
      id: makeId(timestamp),
      infinitive: input.infinitive,
      group: input.group,
      now: timestamp,
    });
    verbs = [...verbs, verb];
    revision++;
    publish();
    await writeNow();
    return verb;
  }

  function setRow(
    verbId: string,
    index: number,
    patch: Partial<ConjugationRow>,
  ): void {
    const timestamp = now();
    let found = false;
    verbs = verbs.map(verb => {
      if (verb.id !== verbId) {
        return verb;
      }
      found = true;
      return withRow(verb, index, patch, timestamp);
    });
    if (!found) {
      return;
    }
    revision++;
    publish();
    schedulePersist();
  }

  function setInfinitive(verbId: string, infinitive: string): void {
    const timestamp = now();
    let found = false;
    verbs = verbs.map(verb => {
      if (verb.id !== verbId) {
        return verb;
      }
      found = true;
      return withInfinitive(verb, infinitive, timestamp);
    });
    if (!found) {
      return;
    }
    revision++;
    publish();
    schedulePersist();
  }

  function setNote(verbId: string, note: string): void {
    const timestamp = now();
    let found = false;
    verbs = verbs.map(verb => {
      if (verb.id !== verbId) {
        return verb;
      }
      found = true;
      return withNote(verb, note, timestamp);
    });
    if (!found) {
      return;
    }
    revision++;
    publish();
    schedulePersist();
  }

  // Structural like a reorder, and written at once for the same reason: the
  // entry changes hands between two lists, and a crash mid-debounce would put
  // it back in the group the user just took it out of.
  async function setGroup(verbId: string, group: Group): Promise<void> {
    const next = moveToGroup(verbs, verbId, group, now());
    if (next === verbs) {
      return;
    }
    verbs = next;
    revision++;
    publish();
    await writeNow();
  }

  // The star is a deliberate write, not a keystroke: one gesture, one answer
  // on disk. A crash between the press and the debounce must not cost the mark
  // the owner just put on an entry — the same reason a group change is written
  // at once. The move that comes with it is part of that one write: value and
  // position land together, never half of each.
  //
  // Completeness is the row's gate, not the store's: a star written on a
  // complete entry is kept when a row is later emptied (the mark hides, the
  // record stays), so refusing to store it would make the model disagree with
  // the state the list is built to show.
  async function setStarred(verbId: string, starred: boolean): Promise<void> {
    const next = starAndMove(verbs, verbId, starred, now());
    if (next === verbs) {
      return;
    }
    verbs = next;
    revision++;
    publish();
    await writeNow();
  }

  // Not debounced like typing: reordering is structural, and the entry
  // objects themselves are only moved, never rewritten, so updatedAt stays
  // a record of content changes.
  async function reorderVerb(verbId: string, toIndex: number): Promise<void> {
    const next = reorderWithinGroup(verbs, verbId, toIndex);
    if (next === verbs) {
      return;
    }
    verbs = next;
    revision++;
    publish();
    await writeNow();
  }

  async function removeVerb(verbId: string): Promise<void> {
    const next = verbs.filter(verb => verb.id !== verbId);
    if (next.length === verbs.length) {
      return;
    }
    verbs = next;
    revision++;
    publish();
    await writeNow();
  }

  // An import replaces the whole codex in a single write, and marks the seed as
  // done: a codex that came out of a file must never sprout the demo entries.
  async function replaceAll(next: Verb[]): Promise<void> {
    verbs = next;
    revision++;
    publish();
    try {
      await storage.setItem(SEEDED_KEY, 'true');
    } catch {
      // Worst case the seed runs again on an empty codex; never fatal.
    }
    await writeNow();
  }

  return {
    subscribe: envelope.subscribe,
    getSnapshot: envelope.getSnapshot,
    init,
    flush: writeNow,
    addVerb,
    setRow,
    setInfinitive,
    setNote,
    setStarred,
    setGroup,
    reorderVerb,
    removeVerb,
    replaceAll,
  };
}

async function seedAlreadyRan(storage: KeyValueStorage): Promise<boolean> {
  return (await readItem(storage, SEEDED_KEY)) === 'true';
}

export const verbStore = createVerbStore(asyncStorageAdapter);

export function useVerbState(): VerbState {
  return useEnvelope(verbStore);
}

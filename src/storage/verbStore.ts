import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConjugationRow, Group, Verb } from '../types';
import {
  createVerb,
  nextVerbId,
  parseVerbs,
  withInfinitive,
  withNote,
  withRow,
} from '../domain/verbs';
import { seedVerbs } from '../data/seed';

export const VERBS_KEY = 'verbcodex.verbs.v1';
export const SEEDED_KEY = 'verbcodex.seeded.v1';
export const PERSIST_DEBOUNCE_MS = 300;

/** The slice of key/value storage the store needs; injected so tests stay native-free. */
export type VerbStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const asyncStorageAdapter: VerbStorage = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

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
  removeVerb(verbId: string): Promise<void>;
};

export function createVerbStore(
  storage: VerbStorage,
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
  let snapshot: VerbState = { verbs, ready };
  const listeners = new Set<() => void>();

  // Structural edits are written straight away; keystrokes coalesce. A revision
  // counter (rather than a dirty flag) keeps that correct when a write is still
  // in flight while the user keeps typing.
  let revision = 0;
  let writtenRevision = -1;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function publish(): void {
    snapshot = { verbs, ready };
    listeners.forEach(listener => listener());
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
    let raw: string | null = null;
    try {
      raw = await storage.getItem(VERBS_KEY);
    } catch {
      raw = null;
    }
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

  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    init,
    flush: writeNow,
    addVerb,
    setRow,
    setInfinitive,
    setNote,
    removeVerb,
  };
}

async function seedAlreadyRan(storage: VerbStorage): Promise<boolean> {
  try {
    return (await storage.getItem(SEEDED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export const verbStore = createVerbStore(asyncStorageAdapter);

export function useVerbState(): VerbState {
  return useSyncExternalStore(verbStore.subscribe, verbStore.getSnapshot);
}

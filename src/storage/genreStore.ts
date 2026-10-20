import { useSyncExternalStore } from 'react';
import { asyncStorageAdapter } from './asyncStorageAdapter';
import {
  emptyReview,
  parseReview,
  recordRight as advanceBox,
  recordWrong as backToBoxOne,
  serializeReview,
} from '../domain/genre';
import type { Gender, ReviewState, RightOutcome } from '../domain/genre';

export const GENRE_KEY = 'verbcodex.genre.v1';

/** The slice of key/value storage the ledger needs; injected so tests stay native-free. */
export type GenreStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type GenreState = {
  review: ReviewState;
  ready: boolean;
};

export type GenreStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GenreState;
  init(): Promise<void>;
  flush(): Promise<void>;
  recordWrong(noun: { w: string; g: Gender }): void;
  recordRight(noun: { w: string; g: Gender }): RightOutcome;
  clear(): void;
};

/**
 * The review box: the codex's own ledger of which nouns the drill owes back.
 *
 * Unlike a recorded value it is written the moment it changes rather than
 * debounced — one answer is one fact, there is nothing to coalesce, and a
 * ledger that was half a question behind when the app was swiped away would
 * re-ask a noun the owner had just got right. `flush` retries on the way out;
 * a failed write leaves the ledger usable in memory.
 *
 * The key is the app's own, not the prototype's (`verbcodex-demo-genre:v1`):
 * the demo's localStorage is a rehearsal, not something to inherit.
 */
export function createGenreStore(
  storage: GenreStorage,
  options: { now?: () => number } = {},
): GenreStore {
  const now = options.now ?? Date.now;
  let review: ReviewState = emptyReview();
  let ready = false;
  let snapshot: GenreState = { review, ready };
  const listeners = new Set<() => void>();

  function publish(): void {
    snapshot = { review, ready };
    listeners.forEach(listener => listener());
  }

  function write(): Promise<void> {
    return storage.setItem(GENRE_KEY, serializeReview(review)).catch(() => {
      // Keep the ledger usable in memory; `flush` retries on the way out.
    });
  }

  async function init(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await storage.getItem(GENRE_KEY);
    } catch {
      raw = null;
    }
    review = parseReview(raw);
    ready = true;
    publish();
  }

  function recordWrong(noun: { w: string; g: Gender }): void {
    review = backToBoxOne(review, noun, now());
    publish();
    write();
  }

  function recordRight(noun: { w: string; g: Gender }): RightOutcome {
    const written = advanceBox(review, noun, now());
    review = written.state;
    publish();
    write();
    return written.outcome;
  }

  function clear(): void {
    review = emptyReview();
    publish();
    write();
  }

  async function flush(): Promise<void> {
    await write();
  }

  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    init,
    recordWrong,
    recordRight,
    clear,
    flush,
  };
}

export const genreStore = createGenreStore(asyncStorageAdapter);

export function useGenreState(): GenreState {
  return useSyncExternalStore(genreStore.subscribe, genreStore.getSnapshot);
}

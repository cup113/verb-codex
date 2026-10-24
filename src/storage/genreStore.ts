import { useSyncExternalStore } from 'react';
import { asyncStorageAdapter } from './asyncStorageAdapter';
import type { KeyValueStorage } from './keyValueStorage';
import { emptyReview, parseReview, serializeReview } from '../domain/genre';
import type { ReviewState } from '../domain/genre';

export const GENRE_KEY = 'verbcodex.genre.v1';

export type GenreState = {
  review: ReviewState;
  ready: boolean;
};

export type GenreStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GenreState;
  init(): Promise<void>;
  flush(): Promise<void>;
  /** Keep a ledger the sitting has already worked out; one answer, one write. */
  apply(review: ReviewState): void;
  clear(): void;
};

/**
 * The review box: the codex's own ledger of which nouns the drill owes back.
 *
 * It keeps the boxes and nothing else — what an answer *did* to them is the
 * sitting's business (`domain/sitting.ts`), which hands the result here to be
 * written down. So this store reads no clock and applies no rule: it is a
 * record, like the codex's other ones.
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
export function createGenreStore(storage: KeyValueStorage): GenreStore {
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

  function apply(next: ReviewState): void {
    // The very same ledger is not a change: a refused answer hands it back
    // untouched, and nothing should reach the disk for it.
    if (next === review) {
      return;
    }
    review = next;
    publish();
    write();
  }

  function clear(): void {
    apply(emptyReview());
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
    flush,
    apply,
    clear,
  };
}

export const genreStore = createGenreStore(asyncStorageAdapter);

export function useGenreState(): GenreState {
  return useSyncExternalStore(genreStore.subscribe, genreStore.getSnapshot);
}

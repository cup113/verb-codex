import { useSyncExternalStore } from 'react';

/** The read side — all a component ever needs. */
export type Readable<S> = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): S;
};

export type Envelope<S> = Readable<S> & {
  publish(): void;
};

/**
 * The reactive shell every store wraps its value in: a cached snapshot, the
 * listeners, and the one way to swap the snapshot in front of them.
 *
 * `build` closes over the store's own mutable variables, so `publish` always
 * photographs the value as it stands right now. The cache is not decoration:
 * `useSyncExternalStore` demands that `getSnapshot` return the same reference
 * until something changes, so the snapshot is built once per `publish`, never
 * per read.
 *
 * What it deliberately does not know: the device (`KeyValueStorage`), the
 * shape of the value, or when anything reaches the disk. A store's write
 * policy — debounced, immediate, or skipped — is that store's own depth, and
 * none of it fits in here without becoming a framework.
 */
export function createEnvelope<S>(build: () => S): Envelope<S> {
  let snapshot = build();
  const listeners = new Set<() => void>();
  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    publish: () => {
      snapshot = build();
      listeners.forEach(listener => listener());
    },
  };
}

export function useEnvelope<S>(readable: Readable<S>): S {
  return useSyncExternalStore(readable.subscribe, readable.getSnapshot);
}

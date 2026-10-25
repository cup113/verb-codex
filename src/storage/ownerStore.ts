import { asyncStorageAdapter } from './asyncStorageAdapter';
import { createEnvelope, useEnvelope } from './envelope';
import { readItem } from './keyValueStorage';
import type { KeyValueStorage } from './keyValueStorage';

export const OWNER_KEY = 'verbcodex.owner.v1';

export type OwnerState = {
  owner: string;
  ready: boolean;
};

export type OwnerStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): OwnerState;
  init(): Promise<void>;
  setOwner(owner: string): void;
  flush(): Promise<void>;
};

/**
 * The name the codex greets its owner by.
 *
 * One short string, so it is written the moment it is committed rather than
 * debounced like the keystroke streams the verb store handles: there is
 * nothing to coalesce, and a name that was typed and confirmed should not be
 * waiting on a timer when the app is swiped away. The screen keeps the raw
 * draft while the field has focus and calls this on blur — an empty name is a
 * legitimate value, not a reason to keep the old one.
 */
export function createOwnerStore(storage: KeyValueStorage): OwnerStore {
  let owner = '';
  let ready = false;
  const envelope = createEnvelope<OwnerState>(() => ({ owner, ready }));

  function publish(): void {
    envelope.publish();
  }

  function write(): Promise<void> {
    // Spaces around a name are typing, not content: the codex records the name
    // itself, so both the stored value and the greeting are trimmed.
    return storage.setItem(OWNER_KEY, owner).catch(() => {
      // Keep the greeting usable in memory; `flush` retries on the way out.
    });
  }

  async function init(): Promise<void> {
    const raw = await readItem(storage, OWNER_KEY);
    owner = raw === null ? '' : raw.trim();
    ready = true;
    publish();
  }

  function setOwner(next: string): void {
    const trimmed = next.trim();
    if (trimmed === owner) {
      return;
    }
    owner = trimmed;
    publish();
    write();
  }

  async function flush(): Promise<void> {
    await write();
  }

  return {
    subscribe: envelope.subscribe,
    getSnapshot: envelope.getSnapshot,
    init,
    setOwner,
    flush,
  };
}

export const ownerStore = createOwnerStore(asyncStorageAdapter);

export function useOwnerState(): OwnerState {
  return useEnvelope(ownerStore);
}

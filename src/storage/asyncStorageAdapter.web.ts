import type { KeyValueStorage } from './keyValueStorage';

/**
 * Web: AsyncStorage v3 ships no browser build at all (its platform folders
 * are android, apple and windows), so the codex is kept in localStorage.
 * A notebook is a few kilobytes, well inside the 5 MiB per-origin cap — and
 * the store's port is the only thing that had to change for the swap.
 *
 * Note that browser storage is evictable, so a web build must not treat it
 * as the only copy: see the export/import note in the README.
 */
export const asyncStorageAdapter: KeyValueStorage = {
  getItem: async key => window.localStorage.getItem(key),
  setItem: async (key, value) => {
    window.localStorage.setItem(key, value);
  },
};

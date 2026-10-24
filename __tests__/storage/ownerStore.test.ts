import { OWNER_KEY, createOwnerStore } from '../../src/storage/ownerStore';
import type { KeyValueStorage } from '../../src/storage/keyValueStorage';

function memoryStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: KeyValueStorage = {
    getItem: async key => entries.get(key) ?? null,
    setItem: async (key, value) => {
      entries.set(key, value);
      writes.push(key);
    },
  };
  return { storage, entries, writes };
}

describe('createOwnerStore', () => {
  it('starts with no name at all', async () => {
    const { storage } = memoryStorage();
    const store = createOwnerStore(storage);

    expect(store.getSnapshot()).toEqual({ owner: '', ready: false });
    await store.init();
    expect(store.getSnapshot()).toEqual({ owner: '', ready: true });
  });

  it('reads back the name that was recorded', async () => {
    const { storage } = memoryStorage({ [OWNER_KEY]: 'Camille' });
    const store = createOwnerStore(storage);

    await store.init();

    expect(store.getSnapshot().owner).toBe('Camille');
  });

  it('trims the name on the way in and on the way out', async () => {
    const { storage, entries } = memoryStorage({ [OWNER_KEY]: '  Camille  ' });
    const store = createOwnerStore(storage);

    await store.init();
    expect(store.getSnapshot().owner).toBe('Camille');

    store.setOwner('  Léa  ');
    await store.flush();

    expect(entries.get(OWNER_KEY)).toBe('Léa');
  });

  it('writes a name the moment it is committed, not on a timer', () => {
    // One short string: there is nothing to coalesce, and a name that was just
    // confirmed must not still be waiting on a debounce when the app goes away.
    const { storage, entries, writes } = memoryStorage();
    const store = createOwnerStore(storage);

    store.setOwner('Camille');

    expect(entries.get(OWNER_KEY)).toBe('Camille');
    expect(writes).toEqual([OWNER_KEY]);
  });

  it('does not write again for a name that only differs by spacing', async () => {
    const { storage, writes } = memoryStorage({ [OWNER_KEY]: 'Camille' });
    const store = createOwnerStore(storage);
    await store.init();
    writes.length = 0;

    store.setOwner('  Camille ');

    expect(store.getSnapshot().owner).toBe('Camille');
    expect(writes).toEqual([]);
  });

  it('tells its subscribers each time the name changes', () => {
    const { storage } = memoryStorage();
    const store = createOwnerStore(storage);
    const seen: string[] = [];
    const unsubscribe = store.subscribe(() =>
      seen.push(store.getSnapshot().owner),
    );

    store.setOwner('Camille');
    store.setOwner('Camille ');
    store.setOwner('Léa');
    unsubscribe();
    store.setOwner('Anouk');

    expect(seen).toEqual(['Camille', 'Léa']);
  });

  it('keeps the greeting working when the store refuses to write', async () => {
    const refusing: KeyValueStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('quota exceeded');
      },
    };
    const store = createOwnerStore(refusing);

    await store.init();
    store.setOwner('Camille');
    await store.flush();

    expect(store.getSnapshot().owner).toBe('Camille');
  });

  it('treats an unreadable store as a codex with no name yet', async () => {
    const unreadable: KeyValueStorage = {
      getItem: async () => {
        throw new Error('blocked');
      },
      setItem: async () => {},
    };
    const store = createOwnerStore(unreadable);

    await store.init();

    expect(store.getSnapshot()).toEqual({ owner: '', ready: true });
  });
});

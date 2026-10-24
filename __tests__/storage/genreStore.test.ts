import { GENRE_KEY, createGenreStore } from '../../src/storage/genreStore';
import type { KeyValueStorage } from '../../src/storage/keyValueStorage';
import {
  emptyReview,
  recordRight,
  recordWrong,
  serializeReview,
} from '../../src/domain/genre';
import type { ReviewState } from '../../src/domain/genre';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

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

/** A ledger holding one word in box 1, due at once — what a wrong answer leaves. */
function boxOne(w: string, g: 'm' | 'f'): ReviewState {
  return recordWrong(emptyReview(), { w, g }, NOW);
}

describe('createGenreStore', () => {
  it('starts with an empty ledger', async () => {
    const { storage } = memoryStorage();
    const store = createGenreStore(storage);

    expect(store.getSnapshot()).toEqual({
      review: { items: {} },
      ready: false,
    });
    await store.init();
    expect(store.getSnapshot().ready).toBe(true);
    expect(store.getSnapshot().review.items).toEqual({});
  });

  it('reads back the boxes that were written', async () => {
    const { storage } = memoryStorage({
      [GENRE_KEY]: serializeReview({
        items: { vie: { w: 'vie', g: 'f', box: 3, due: NOW } },
      }),
    });
    const store = createGenreStore(storage);

    await store.init();

    expect(store.getSnapshot().review.items.vie.box).toBe(3);
  });

  it('treats an unreadable key as an empty ledger', async () => {
    const broken: KeyValueStorage = {
      getItem: async () => '{"items":',
      setItem: async () => {},
    };
    const store = createGenreStore(broken);

    await store.init();

    expect(store.getSnapshot()).toEqual({ review: { items: {} }, ready: true });
  });

  it('writes a ledger the moment it is handed one, not on a timer', () => {
    const { storage, entries, writes } = memoryStorage();
    const store = createGenreStore(storage);

    store.apply(boxOne('vie', 'f'));

    expect(writes).toEqual([GENRE_KEY]);
    const written = JSON.parse(entries.get(GENRE_KEY) ?? '{}');
    expect(written.items.vie).toEqual({ w: 'vie', g: 'f', box: 1, due: NOW });
  });

  it('keeps a box the sitting already moved, intervals and all', () => {
    const { storage, entries } = memoryStorage();
    const store = createGenreStore(storage);

    store.apply(
      recordRight(boxOne('vie', 'f'), { w: 'vie', g: 'f' }, NOW).state,
    );

    const written = JSON.parse(entries.get(GENRE_KEY) ?? '{}');
    expect(written.items.vie.box).toBe(2);
    expect(written.items.vie.due).toBe(NOW + DAY);
    expect(store.getSnapshot().review.items.vie.box).toBe(2);
  });

  it('writes nothing for the very ledger it already holds', () => {
    const { storage, writes } = memoryStorage();
    const store = createGenreStore(storage);
    const ledger = boxOne('vie', 'f');
    store.apply(ledger);
    writes.length = 0;

    // A refused answer hands the same ledger back; touching that is not a
    // change, and it must not reach the disk.
    store.apply(ledger);

    expect(writes).toEqual([]);
  });

  it('clears the ledger without touching anything else', async () => {
    const { storage, entries } = memoryStorage();
    const store = createGenreStore(storage);
    store.apply(boxOne('vie', 'f'));

    store.clear();
    await store.flush();

    expect(store.getSnapshot().review.items).toEqual({});
    expect(JSON.parse(entries.get(GENRE_KEY) ?? '{}').items).toEqual({});
  });

  it('tells its subscribers each time the ledger changes', () => {
    const { storage } = memoryStorage();
    const store = createGenreStore(storage);
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() =>
      seen.push(Object.keys(store.getSnapshot().review.items).length),
    );

    store.apply(boxOne('vie', 'f'));
    store.apply(
      recordWrong(store.getSnapshot().review, { w: 'temps', g: 'm' }, NOW),
    );
    unsubscribe();
    store.apply(boxOne('nuit', 'f'));

    expect(seen).toEqual([1, 2]);
  });

  it('publishes a new snapshot object on every change', () => {
    const { storage } = memoryStorage();
    const store = createGenreStore(storage);
    const before = store.getSnapshot();

    store.apply(boxOne('vie', 'f'));

    expect(store.getSnapshot()).not.toBe(before);
  });

  it('keeps the drill usable when the store refuses to write', async () => {
    const refusing: KeyValueStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('quota exceeded');
      },
    };
    const store = createGenreStore(refusing);

    await store.init();
    store.apply(boxOne('vie', 'f'));
    await store.flush();

    expect(store.getSnapshot().review.items.vie.box).toBe(1);
  });
});

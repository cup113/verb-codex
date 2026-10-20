import {
  GENRE_KEY,
  GenreStorage,
  createGenreStore,
} from '../../src/storage/genreStore';
import { serializeReview } from '../../src/domain/genre';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function memoryStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: GenreStorage = {
    getItem: async key => entries.get(key) ?? null,
    setItem: async (key, value) => {
      entries.set(key, value);
      writes.push(key);
    },
  };
  return { storage, entries, writes };
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
    const store = createGenreStore(storage, { now: () => NOW });

    await store.init();

    expect(store.getSnapshot().review.items.vie.box).toBe(3);
  });

  it('treats an unreadable key as an empty ledger', async () => {
    const broken: GenreStorage = {
      getItem: async () => '{"items":',
      setItem: async () => {},
    };
    const store = createGenreStore(broken);

    await store.init();

    expect(store.getSnapshot()).toEqual({ review: { items: {} }, ready: true });
  });

  it('writes a wrong answer the moment it happens, not on a timer', () => {
    const { storage, entries, writes } = memoryStorage();
    const store = createGenreStore(storage, { now: () => NOW });

    store.recordWrong({ w: 'vie', g: 'f' });

    expect(writes).toEqual([GENRE_KEY]);
    const written = JSON.parse(entries.get(GENRE_KEY) ?? '{}');
    expect(written.items.vie).toEqual({ w: 'vie', g: 'f', box: 1, due: NOW });
  });

  it('hands back what a right answer did and persists the new box', () => {
    const { storage, entries } = memoryStorage();
    const store = createGenreStore(storage, { now: () => NOW });
    store.recordWrong({ w: 'vie', g: 'f' });

    const outcome = store.recordRight({ w: 'vie', g: 'f' });

    expect(outcome).toEqual({ kind: 'advanced', box: 2 });
    const written = JSON.parse(entries.get(GENRE_KEY) ?? '{}');
    expect(written.items.vie.box).toBe(2);
    expect(written.items.vie.due).toBe(NOW + DAY);
  });

  it('says nothing when a right answer is not in the ledger', () => {
    const { storage } = memoryStorage();
    const store = createGenreStore(storage, { now: () => NOW });

    expect(store.recordRight({ w: 'vie', g: 'f' })).toEqual({ kind: 'none' });
  });

  it('clears the ledger without touching anything else', async () => {
    const { storage, entries } = memoryStorage();
    const store = createGenreStore(storage, { now: () => NOW });
    store.recordWrong({ w: 'vie', g: 'f' });

    store.clear();
    await store.flush();

    expect(store.getSnapshot().review.items).toEqual({});
    expect(JSON.parse(entries.get(GENRE_KEY) ?? '{}').items).toEqual({});
  });

  it('tells its subscribers each time the ledger changes', () => {
    const { storage } = memoryStorage();
    const store = createGenreStore(storage, { now: () => NOW });
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() =>
      seen.push(Object.keys(store.getSnapshot().review.items).length),
    );

    store.recordWrong({ w: 'vie', g: 'f' });
    store.recordWrong({ w: 'temps', g: 'm' });
    unsubscribe();
    store.recordWrong({ w: 'nuit', g: 'f' });

    expect(seen).toEqual([1, 2]);
  });

  it('publishes a new snapshot object on every change', () => {
    const { storage } = memoryStorage();
    const store = createGenreStore(storage, { now: () => NOW });
    const before = store.getSnapshot();

    store.recordWrong({ w: 'vie', g: 'f' });

    expect(store.getSnapshot()).not.toBe(before);
  });

  it('keeps the drill usable when the store refuses to write', async () => {
    const refusing: GenreStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('quota exceeded');
      },
    };
    const store = createGenreStore(refusing, { now: () => NOW });

    await store.init();
    store.recordWrong({ w: 'vie', g: 'f' });
    await store.flush();

    expect(store.getSnapshot().review.items.vie.box).toBe(1);
  });
});

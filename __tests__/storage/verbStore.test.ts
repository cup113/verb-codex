import { emptyRows } from '../../src/domain/verbs';
import {
  SEEDED_KEY,
  VERBS_KEY,
  VerbStorage,
  createVerbStore,
} from '../../src/storage/verbStore';
import { Verb } from '../../src/types';

const NOW = 1_700_000_000_000;

// A large debounce keeps every coalesced write pending until the test flushes,
// so "did it write?" is never a race against a timer.
// Unique per call: a constant id would make two entries indistinguishable to
// the reorder and remove operations.
let nextId = 0;
const OPTIONS = {
  now: () => NOW,
  debounceMs: 60_000,
  id: () => `v${++nextId}`,
};

function memoryStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: VerbStorage = {
    getItem: async key => entries.get(key) ?? null,
    setItem: async (key, value) => {
      entries.set(key, value);
      writes.push(key);
    },
  };
  return { storage, entries, writes };
}

function seededCodex(): Verb[] {
  return [
    {
      id: 'seed-aimer',
      infinitive: 'aimer',
      group: 1,
      tense: 'present',
      rows: emptyRows().map((row, index) =>
        index === 0 ? { form: 'aime' } : row,
      ),
      note: '',
      createdAt: 0,
      updatedAt: 0,
    },
  ];
}

function persisted(entries: Map<string, string>): Verb[] {
  return JSON.parse(entries.get(VERBS_KEY) as string) as Verb[];
}

describe('createVerbStore', () => {
  it('seeds the codex once, on an empty first launch', async () => {
    const { storage, entries } = memoryStorage();
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });

    await store.init();

    expect(store.getSnapshot().ready).toBe(true);
    expect(store.getSnapshot().verbs.map(verb => verb.infinitive)).toEqual([
      'aimer',
    ]);
    expect(entries.get(SEEDED_KEY)).toBe('true');
    expect(persisted(entries)).toHaveLength(1);
  });

  it('never re-seeds once the user has emptied the codex', async () => {
    const { storage } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });

    await store.init();

    expect(store.getSnapshot().verbs).toEqual([]);
  });

  it('reads recorded entries back instead of seeding', async () => {
    const { storage } = memoryStorage();
    const first = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await first.init();
    await first.addVerb({ infinitive: 'finir', group: 2 });

    const second = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await second.init();

    expect(second.getSnapshot().verbs.map(verb => verb.infinitive)).toEqual([
      'aimer',
      'finir',
    ]);
  });

  it('records a new entry with six blank rows and writes it straight away', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();

    const verb = await store.addVerb({ infinitive: '  finir ', group: 2 });

    expect(verb.infinitive).toBe('finir');
    expect(verb.group).toBe(2);
    expect(verb.rows).toEqual(emptyRows());
    expect(verb.note).toBe('');
    expect(persisted(entries)).toHaveLength(1);
  });

  it('coalesces keystrokes and writes them on flush', async () => {
    const { storage, entries, writes } = memoryStorage({
      [SEEDED_KEY]: 'true',
    });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const verb = await store.addVerb({ infinitive: 'aimer', group: 1 });
    const writesAfterAdd = writes.length;

    store.setRow(verb.id, 0, { form: 'aime' });
    store.setRow(verb.id, 1, { form: 'aimes' });

    expect(writes.length).toBe(writesAfterAdd);

    await store.flush();

    expect(writes.length).toBe(writesAfterAdd + 1);
    expect(persisted(entries)[0].rows[0]).toEqual({ form: 'aime' });
    expect(persisted(entries)[0].rows[1]).toEqual({ form: 'aimes' });
  });

  it('keeps typing that happened while a write was already under way', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const verb = await store.addVerb({ infinitive: 'aimer', group: 1 });

    store.setRow(verb.id, 0, { form: 'aim' });
    const inFlight = store.flush();
    store.setRow(verb.id, 0, { form: 'aime' });
    await inFlight;
    await store.flush();

    const rows = persisted(entries)[0].rows;
    expect(rows[0]).toEqual({ form: 'aime' });
  });

  it('survives a failing write and retries it on the next flush', async () => {
    let failing = true;
    const entries = new Map<string, string>();
    const storage: VerbStorage = {
      getItem: async key => entries.get(key) ?? null,
      setItem: async (key, value) => {
        if (failing) {
          throw new Error('disk unavailable');
        }
        entries.set(key, value);
      },
    };
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });

    await store.init();

    // Nothing reached the disk, yet the entry is still there in memory.
    expect(store.getSnapshot().verbs.map(verb => verb.infinitive)).toEqual([
      'aimer',
    ]);
    expect(entries.has(VERBS_KEY)).toBe(false);

    failing = false;
    await store.flush();

    expect(persisted(entries)).toHaveLength(1);
  });

  it('drops a deleted entry and writes the removal at once', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const verb = await store.addVerb({ infinitive: 'aimer', group: 1 });

    await store.removeVerb(verb.id);

    expect(store.getSnapshot().verbs).toEqual([]);
    expect(persisted(entries)).toEqual([]);
  });

  it('persists a rename of the infinitive', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const verb = await store.addVerb({ infinitive: 'aimr', group: 1 });

    store.setInfinitive(verb.id, 'aimer');
    await store.flush();

    expect(persisted(entries)[0].infinitive).toBe('aimer');
  });

  it('persists a free-form note, accents included', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const verb = await store.addVerb({ infinitive: 'aimer', group: 1 });

    store.setNote(verb.id, 'prononciation : èmé');
    await store.flush();

    expect(persisted(entries)[0].note).toBe('prononciation : èmé');
  });

  it('persists a reorder without disturbing the other groups', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const first = await store.addVerb({ infinitive: 'aimer', group: 1 });
    await store.addVerb({ infinitive: 'parler', group: 1 });
    await store.addVerb({ infinitive: 'finir', group: 2 });

    await store.reorderVerb(first.id, 1);

    expect(persisted(entries).map(verb => verb.infinitive)).toEqual([
      'parler',
      'aimer',
      'finir',
    ]);
  });

  it('ignores edits addressed to an entry that is gone', async () => {
    const { storage } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();

    store.setRow('missing', 0, { form: 'aime' });
    store.setInfinitive('missing', 'aimer');

    expect(store.getSnapshot().verbs).toEqual([]);
  });

  it('hands out a stable snapshot until something actually changes', async () => {
    const { storage } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    const before = store.getSnapshot();

    expect(store.getSnapshot()).toBe(before);

    await store.addVerb({ infinitive: 'aimer', group: 1 });

    expect(store.getSnapshot()).not.toBe(before);
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const { storage } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    await store.addVerb({ infinitive: 'aimer', group: 1 });
    expect(notifications).toBe(1);

    unsubscribe();
    await store.addVerb({ infinitive: 'finir', group: 2 });
    expect(notifications).toBe(1);
  });

  it('replaces the whole codex from an import, writing it out at once', async () => {
    const { storage, entries } = memoryStorage({ [SEEDED_KEY]: 'true' });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    await store.addVerb({ infinitive: 'aimer', group: 1 });
    const imported: Verb[] = [
      { ...seededCodex()[0], id: 'i1', infinitive: 'aller' },
      { ...seededCodex()[0], id: 'i2', infinitive: 'finir', group: 2 },
    ];

    await store.replaceAll(imported);

    expect(store.getSnapshot().verbs.map(verb => verb.infinitive)).toEqual([
      'aller',
      'finir',
    ]);
    expect(persisted(entries).map(verb => verb.infinitive)).toEqual([
      'aller',
      'finir',
    ]);
  });

  it('marks the seed as done when importing, so a relaunch cannot re-seed', async () => {
    // Storage that predates the flag: entries but no marker. Without the write
    // inside replaceAll, the next launch would find an empty codex and seed it.
    const { storage, entries } = memoryStorage({
      [VERBS_KEY]: JSON.stringify(seededCodex()),
    });
    const store = createVerbStore(storage, { ...OPTIONS, seed: seededCodex });
    await store.init();
    expect(entries.get(SEEDED_KEY)).toBeUndefined();

    await store.replaceAll([]);

    expect(entries.get(SEEDED_KEY)).toBe('true');
    expect(persisted(entries)).toEqual([]);

    const relaunched = createVerbStore(storage, {
      ...OPTIONS,
      seed: seededCodex,
    });
    await relaunched.init();

    expect(relaunched.getSnapshot().verbs).toEqual([]);
  });
});

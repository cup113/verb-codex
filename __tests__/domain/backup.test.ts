import {
  backupFileName,
  parseBackup,
  serializeBackup,
} from '../../src/domain/backup';
import { emptyRows } from '../../src/domain/verbs';
import { Verb } from '../../src/types';

const EXPORTED_AT = '2026-10-15T12:34:56.789Z';

function verb(overrides: Partial<Verb> = {}): Verb {
  return {
    id: 'v1',
    infinitive: 'aimer',
    group: 1,
    tense: 'present',
    rows: emptyRows().map((row, index) =>
      index === 0 ? { stem: 'aim', ending: 'e' } : row,
    ),
    note: 'aimer + infinitif',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('serializeBackup', () => {
  it('round-trips every field of every entry', () => {
    const verbs = [verb(), verb({ id: 'v2', infinitive: 'finir', group: 2 })];

    const read = parseBackup(serializeBackup(verbs, EXPORTED_AT));

    expect(read.ok).toBe(true);
    expect(read.ok && read.verbs).toEqual(verbs);
    expect(read.ok && read.exportedAt).toBe(EXPORTED_AT);
  });

  it('indents the file, so its owner can read and diff it', () => {
    expect(serializeBackup([verb()], EXPORTED_AT)).toContain(
      '\n  "app": "verbcodex"',
    );
  });
});

describe('parseBackup', () => {
  it('accepts a bare array, which is what the store keeps on disk', () => {
    const read = parseBackup(JSON.stringify([verb()]));

    expect(read.ok && read.verbs.map(v => v.infinitive)).toEqual(['aimer']);
    expect(read.ok && read.exportedAt).toBeNull();
  });

  it('coerces a partial entry instead of failing the whole file', () => {
    const read = parseBackup(
      JSON.stringify({
        app: 'verbcodex',
        format: 1,
        verbs: [{ id: 'v9', infinitive: 'aller' }],
      }),
    );

    expect(read.ok).toBe(true);
    expect(read.ok && read.verbs[0]).toEqual({
      id: 'v9',
      infinitive: 'aller',
      group: 1,
      tense: 'present',
      rows: emptyRows(),
      note: '',
      createdAt: 0,
      updatedAt: 0,
    });
  });

  it('drops entries that cannot be read at all, keeping the rest', () => {
    const read = parseBackup(
      JSON.stringify([null, 42, { infinitive: 'sans identifiant' }, verb()]),
    );

    expect(read.ok && read.verbs.map(v => v.infinitive)).toEqual(['aimer']);
  });

  it('refuses a format from a newer version rather than emptying the codex', () => {
    const read = parseBackup(
      JSON.stringify({ app: 'verbcodex', format: 99, verbs: [verb()] }),
    );

    expect(read).toEqual({ ok: false, problem: 'newer-format' });
  });

  it('refuses a backup with nothing readable in it', () => {
    const read = parseBackup(
      JSON.stringify({ app: 'verbcodex', format: 1, verbs: [] }),
    );

    expect(read).toEqual({ ok: false, problem: 'no-verbs' });
  });

  it('refuses text that is not JSON', () => {
    expect(parseBackup('j’ai oublié de copier le fichier')).toEqual({
      ok: false,
      problem: 'not-json',
    });
  });

  it('refuses a JSON document that came from somewhere else', () => {
    expect(parseBackup('{"hello":"world"}')).toEqual({
      ok: false,
      problem: 'not-backup',
    });
    expect(parseBackup('"just a string"')).toEqual({
      ok: false,
      problem: 'not-backup',
    });
  });

  it('refuses blank input', () => {
    expect(parseBackup('   \n')).toEqual({ ok: false, problem: 'empty' });
  });
});

describe('backupFileName', () => {
  it('dates the file from the moment of the export', () => {
    expect(backupFileName(EXPORTED_AT)).toBe('verbcodex-2026-10-15.json');
  });
});

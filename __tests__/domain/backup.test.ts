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
      index === 0 ? { form: 'aime' } : row,
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

    const read = parseBackup(serializeBackup(verbs, EXPORTED_AT, ''));

    expect(read.ok).toBe(true);
    expect(read.ok && read.verbs).toEqual(verbs);
    expect(read.ok && read.exportedAt).toBe(EXPORTED_AT);
  });

  it('indents the file, so its owner can read and diff it', () => {
    expect(serializeBackup([verb()], EXPORTED_AT, '')).toContain(
      '\n  "app": "verbcodex"',
    );
  });

  it('stamps the whole-word format, which a format-1 build refuses', () => {
    // Pinned as a literal on purpose: this is the number an older install
    // reads before it decides to refuse the file outright rather than import
    // six blank rows.
    expect(serializeBackup([verb()], EXPORTED_AT, '')).toContain('"format": 2');
  });

  it('carries the name the codex greets its owner by', () => {
    const read = parseBackup(serializeBackup([verb()], EXPORTED_AT, 'Camille'));

    expect(read.ok && read.owner).toBe('Camille');
  });

  it('leaves the field out when no name has been recorded', () => {
    // The field states "this codex has a name". An empty one would state a
    // name that is blank, and importing it must not erase the reader's own.
    expect(serializeBackup([verb()], EXPORTED_AT, '')).not.toContain('owner');
  });
});

describe('parseBackup', () => {
  it('accepts a bare array, which is what the store keeps on disk', () => {
    const read = parseBackup(JSON.stringify([verb()]));

    expect(read.ok && read.verbs.map(v => v.infinitive)).toEqual(['aimer']);
    expect(read.ok && read.exportedAt).toBeNull();
    expect(read.ok && read.owner).toBeNull();
  });

  it('reads a file written before the owner field as one with no name', () => {
    // Which is every backup exported by v0.3.0 and earlier: the field simply
    // is not there, and every entry still restores.
    const read = parseBackup(
      JSON.stringify({
        app: 'verbcodex',
        format: 2,
        exportedAt: EXPORTED_AT,
        verbs: [verb()],
      }),
    );

    expect(read.ok && read.owner).toBeNull();
    expect(read.ok && read.verbs.map(v => v.infinitive)).toEqual(['aimer']);
  });

  it('trims the name it restores, and treats a blank one as none at all', () => {
    const trimmed = parseBackup(
      JSON.stringify({
        app: 'verbcodex',
        format: 2,
        owner: '  Camille  ',
        verbs: [verb()],
      }),
    );
    expect(trimmed.ok && trimmed.owner).toBe('Camille');

    const blank = parseBackup(
      JSON.stringify({
        app: 'verbcodex',
        format: 2,
        owner: '   ',
        verbs: [verb()],
      }),
    );
    expect(blank.ok && blank.owner).toBeNull();
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

  it('joins the stem and ending of a format-1 backup', () => {
    // A file exported by v0.2.0, whose rows were a stem plus an ending: it
    // must still restore as the words the user actually typed.
    const read = parseBackup(
      JSON.stringify({
        app: 'verbcodex',
        format: 1,
        verbs: [
          {
            id: 'v1',
            infinitive: 'aimer',
            group: 1,
            rows: [
              { stem: 'aim', ending: 'e' },
              { stem: '', ending: 'vais' },
            ],
          },
        ],
      }),
    );

    expect(read.ok).toBe(true);
    expect(read.ok && read.verbs[0].rows[0]).toEqual({ form: 'aime' });
    expect(read.ok && read.verbs[0].rows[1]).toEqual({ form: 'vais' });
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

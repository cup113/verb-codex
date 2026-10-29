import { Verb } from '../types';
import { coerceVerb } from './verbs';

/**
 * Bumped only when the envelope's shape changes incompatibly.
 *
 * Format 2 is the whole-word conjugation row: a format-1 file still imports —
 * its `stem`/`ending` halves are joined on read — while a format-1 build
 * refuses a format-2 file outright instead of quietly importing six blank
 * rows.
 *
 * The owner's name was added without a bump, because nothing is lost in either
 * direction: an older build reads such a file as it always read one (the extra
 * field is simply not looked at, and every entry is restored), and this build
 * reads a file without the field as a codex that never had a name recorded.
 *
 * The star follows the same rule: a file without `starred` reads as an unmarked
 * codex, and an older build restores every entry but writes the star away on
 * its next export. That is a loss the owner can see and write again, not a
 * reason for an old build to refuse the whole file.
 */
export const BACKUP_FORMAT = 2;
const BACKUP_APP = 'verbcodex';

export type Backup = {
  app: string;
  format: number;
  exportedAt: string;
  /** The name the codex greets its owner by, when one has been recorded. */
  owner?: string;
  verbs: Verb[];
};

/**
 * The whole codex as one value: the entries, and the name it greets its owner
 * by. Every path in and out of the device passes through it, so that "a codex
 * is its entries plus its name" is written once rather than being carried
 * around as two loose arguments.
 */
export type Codex = {
  verbs: Verb[];
  /** `''` when no name has been recorded — the property of a codex as well. */
  owner: string;
};

/**
 * What leaves the device: the document, and the name it is saved under.
 *
 * Both are derived from the same instant, which is the point of returning them
 * together: a caller that built its own file name could date it a second later
 * than the contents and nobody would notice until two exports sat in a folder.
 */
export function writeCodex(
  codex: Codex,
  at: string,
): { text: string; fileName: string } {
  return {
    text: serializeBackup(codex.verbs, at, codex.owner),
    fileName: backupFileName(at),
  };
}

/**
 * The codex a file restores, given the one this device already holds.
 *
 * Two rules, both of them about what a file is allowed to say: its entries
 * replace the codex wholesale (a record its owner keeps is not something to
 * interleave), and its name is adopted only when the file carries one — a
 * backup written before the name was recorded must never erase the name this
 * device already knows. `null` is the parser's way of saying "the file states
 * no name"; a blank one never gets this far.
 */
export function restoreFrom(
  carried: { verbs: Verb[]; owner: string | null },
  into: Codex,
): Codex {
  return { verbs: carried.verbs, owner: carried.owner ?? into.owner };
}

/**
 * The whole codex as one file. Indented on purpose: it is meant to be readable
 * (and diffable) by the person who owns it, not just by the app.
 */
function serializeBackup(
  verbs: Verb[],
  exportedAt: string,
  owner: string,
): string {
  const backup: Backup = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt,
    // Left out rather than written empty: the field says "this codex has a
    // name", and a blank one is not that statement.
    ...(owner === '' ? {} : { owner }),
    verbs,
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/** `verbcodex-2026-10-15.json`, dated from the moment of the export. */
function backupFileName(exportedAt: string): string {
  return `verbcodex-${exportedAt.slice(0, 10)}.json`;
}

export type BackupProblem =
  | 'empty'
  | 'not-json'
  | 'not-backup'
  | 'newer-format'
  | 'no-verbs';

export type BackupRead =
  | {
      ok: true;
      verbs: Verb[];
      exportedAt: string | null;
      /** `null` when the file records no name — see `readOwner`. */
      owner: string | null;
    }
  | { ok: false; problem: BackupProblem };

/**
 * Reads a backup the user pasted or picked.
 *
 * Tolerant in the same spirit as the store's own reader: a hand-copied payload
 * still restores, unreadable entries are dropped rather than failing the whole
 * file, and a file from a *newer* format is refused loudly instead of being
 * silently emptied. A backup with nothing readable in it is refused too — it is
 * far more likely a wrong file than an intent to erase the codex.
 */
export function parseBackup(text: string): BackupRead {
  if (text.trim() === '') {
    return { ok: false, problem: 'empty' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'not-json' };
  }

  // A bare array is exactly what the store keeps on disk, so it is accepted.
  if (Array.isArray(parsed)) {
    const verbs = readVerbs(parsed);
    return verbs.length > 0
      ? { ok: true, verbs, exportedAt: null, owner: null }
      : { ok: false, problem: 'no-verbs' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, problem: 'not-backup' };
  }

  const envelope = parsed as Record<string, unknown>;
  if (envelope.app !== BACKUP_APP || !Array.isArray(envelope.verbs)) {
    return { ok: false, problem: 'not-backup' };
  }
  const format =
    typeof envelope.format === 'number' ? envelope.format : BACKUP_FORMAT;
  if (format > BACKUP_FORMAT) {
    return { ok: false, problem: 'newer-format' };
  }
  const verbs = readVerbs(envelope.verbs);
  if (verbs.length === 0) {
    return { ok: false, problem: 'no-verbs' };
  }
  return {
    ok: true,
    verbs,
    exportedAt:
      typeof envelope.exportedAt === 'string' ? envelope.exportedAt : null,
    owner: readOwner(envelope),
  };
}

/**
 * The owner's name out of an envelope, when it carries a usable one.
 *
 * The field is optional and post-dates format 2, so its absence is ordinary.
 * A blank name counts as absence too: the reader's caller treats `null` as
 * "leave the name alone", and an empty field must never erase a recorded one.
 */
function readOwner(envelope: Record<string, unknown>): string | null {
  if (typeof envelope.owner !== 'string') {
    return null;
  }
  const owner = envelope.owner.trim();
  return owner === '' ? null : owner;
}

function readVerbs(values: unknown[]): Verb[] {
  return values.map(coerceVerb).filter((verb): verb is Verb => verb !== null);
}

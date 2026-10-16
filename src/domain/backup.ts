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
 * The whole codex as one file. Indented on purpose: it is meant to be readable
 * (and diffable) by the person who owns it, not just by the app.
 */
export function serializeBackup(
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
export function backupFileName(exportedAt: string): string {
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

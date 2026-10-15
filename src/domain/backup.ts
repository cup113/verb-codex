import { Verb } from '../types';
import { coerceVerb } from './verbs';

/** Bumped only when the envelope's shape changes incompatibly. */
export const BACKUP_FORMAT = 1;
const BACKUP_APP = 'verbcodex';

export type Backup = {
  app: string;
  format: number;
  exportedAt: string;
  verbs: Verb[];
};

/**
 * The whole codex as one file. Indented on purpose: it is meant to be readable
 * (and diffable) by the person who owns it, not just by the app.
 */
export function serializeBackup(verbs: Verb[], exportedAt: string): string {
  const backup: Backup = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt,
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
  | { ok: true; verbs: Verb[]; exportedAt: string | null }
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
      ? { ok: true, verbs, exportedAt: null }
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
  };
}

function readVerbs(values: unknown[]): Verb[] {
  return values.map(coerceVerb).filter((verb): verb is Verb => verb !== null);
}

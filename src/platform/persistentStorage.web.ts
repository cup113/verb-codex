/**
 * Web: ask the browser to keep this origin's storage out of the eviction pool.
 *
 * Without it storage is *best-effort*: under storage pressure (and on Safari,
 * after seven days without interaction) the browser may drop it without asking.
 * `persist()` opts out of that; it does **not** protect against the user
 * clearing site data by hand, or against a private window. That is why the
 * backup screen exists — and why it says so when this returns false.
 *
 * Asked once per session: the answer cannot change within a load, and asking
 * again on every visit would re-prompt in Firefox.
 */
let asked: Promise<boolean> | null = null;

export function requestPersistentStorage(): Promise<boolean> {
  asked ??= ask();
  return asked;
}

async function ask(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage?.persist) {
    // No API at all (older Safari): the codex is best-effort, full stop.
    return false;
  }
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}

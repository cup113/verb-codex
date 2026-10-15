/**
 * Whether this platform can promise the codex will not be evicted.
 *
 * Android keeps it in app-private storage (AsyncStorage, i.e. Room/SQLite),
 * which the system never clears on its own — there is nothing to ask for. The
 * web has to ask, and can still be told no: see the `.web` twin.
 */
export function requestPersistentStorage(): Promise<boolean> {
  return Promise.resolve(true);
}

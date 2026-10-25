/**
 * The slice of key/value storage every store needs, and the only thing a store
 * knows about the device: it is injected, so the stores and their tests stay
 * free of native modules.
 *
 * It lives on its own because three stores are ports on it — the entries, the
 * owner's name, the review boxes — and so is the adapter that fills it in. When
 * the type sat in `verbStore` it named the seam after one of its four users,
 * which is exactly backwards.
 */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/**
 * Read a key, treating a refused read as "nothing recorded".
 *
 * A device that cannot answer — no module, quota, a denied origin — must not
 * stop the codex from opening, and every store wants the same recovery: start
 * from the default value and let the next write repair the record. So the rule
 * lives here, once, next to the seam it is a rule about.
 */
export async function readItem(
  storage: KeyValueStorage,
  key: string,
): Promise<string | null> {
  try {
    return await storage.getItem(key);
  } catch {
    return null;
  }
}

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

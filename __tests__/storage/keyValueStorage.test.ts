import { readItem } from '../../src/storage/keyValueStorage';
import type { KeyValueStorage } from '../../src/storage/keyValueStorage';

describe('readItem', () => {
  it('hands back whatever the device recorded', async () => {
    const storage: KeyValueStorage = {
      getItem: async () => '{"items":{}}',
      setItem: async () => {},
    };

    await expect(readItem(storage, 'any.key')).resolves.toBe('{"items":{}}');
  });

  it('treats a refused read as nothing recorded, so the codex still opens', async () => {
    const storage: KeyValueStorage = {
      getItem: async () => {
        throw new Error('blocked');
      },
      setItem: async () => {},
    };

    await expect(readItem(storage, 'any.key')).resolves.toBeNull();
  });
});

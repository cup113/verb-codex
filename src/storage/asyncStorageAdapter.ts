import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from './keyValueStorage';

/** Android and iOS: the AsyncStorage module. */
export const asyncStorageAdapter: KeyValueStorage = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerbStorage } from './verbStore';

/** Android and iOS: the AsyncStorage module. */
export const asyncStorageAdapter: VerbStorage = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

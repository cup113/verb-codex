import type { Group } from './types';

export type RootStackParamList = {
  VerbList: undefined;
  VerbDetail: { verbId: string };
  /**
   * The group the recording starts in. It is required, not optional: the list
   * always has one on show, and an optional param would quietly fall back to
   * the first group exactly when it was forgotten.
   */
  AddVerb: { group: Group };
  Backup: undefined;
};

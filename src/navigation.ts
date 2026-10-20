import type { Group } from './types';

export type RootStackParamList = {
  VerbList: undefined;
  /**
   * `group` is the group the list behind is standing in — the one the way back
   * names. It is handed over rather than read off the entry, because an entry
   * can be moved to another group while its screen is up and the way back must
   * still go to the list it came from. Optional so a route assembled by hand
   * (a test, a restored link) still resolves: without it the entry's own group
   * is the best guess available.
   */
  VerbDetail: { verbId: string; group?: Group };
  /**
   * The group the recording starts in. It is required, not optional: the list
   * always has one on show, and an optional param would quietly fall back to
   * the first group exactly when it was forgotten.
   */
  AddVerb: { group: Group };
  Backup: undefined;
  /** The drill's lobby: its way back is the list it was opened from. */
  Genre: undefined;
  /**
   * One sitting of the drill. `mode` is what the lobby chose, not a state the
   * route keeps current: a sitting that ends offers "Encore" in place, and a
   * review started from that summary never re-enters through here.
   */
  GenreDrill: { mode: 'practice' | 'review' };
};

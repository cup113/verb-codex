import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ROW_COUNT, Verb } from '../types';
import { filledCount, isComplete } from '../domain/verbs';
import { copy } from '../copy';
import { cardSurface, colors, mono, serif } from '../theme';

type Props = {
  verb: Verb;
  onPress: () => void;
  /**
   * Why this entry is on the list, when the headword does not say it — a search
   * that matched one of the six whole words. Absent the rest of the time, so a
   * row is one line unless there is something to explain.
   */
  hint?: string;
  /**
   * A long press on this row. The native list passes an empty function on
   * purpose: picking the row up is the gesture-handler long press the list
   * wraps around it (`DraggableRow` in VerbList.tsx), and setting a long-press
   * handler is the only way to stop React Native from also firing `onPress` on
   * release — which would open the entry after a row was picked up and put
   * back. Absent on the web, where a mouse drag does the reordering.
   */
  onLongPress?: () => void;
  /** True while this row is lifted, on either platform's terms. */
  dragging?: boolean;
};

export function VerbRow({
  verb,
  onPress,
  hint,
  onLongPress,
  dragging = false,
}: Props) {
  const filled = filledCount(verb);
  const complete = isComplete(verb);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      // The six rows are shown as a mark, not as text, so the count they stand
      // for has to be said out loud here or it would be lost to a reader.
      accessibilityLabel={`${verb.infinitive}, ${copy.rowsRecorded(
        filled,
        ROW_COUNT,
      )}`}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        dragging && styles.dragging,
      ]}
    >
      <View style={styles.words}>
        <Text style={styles.infinitive} numberOfLines={1}>
          {verb.infinitive}
        </Text>
        {hint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {/* A filled codex is what this whole screen is for, so the state is drawn
          the way a checked-off line in a notebook is: a tick, in the accent
          diluted to a lighter brown — a mark is a record the paper holds, not a
          call to action. */}
      <View style={styles.mark}>
        {complete ? <View style={styles.tick} /> : <View style={styles.openRow} />}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...cardSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.75,
  },
  // Lifted off the paper while held: the row that is being dragged has to be
  // unmistakably the one under the finger.
  dragging: {
    elevation: 8,
    borderColor: colors.terracotta,
  },
  // The headword and its hint share the slack, so the mark and the chevron
  // stay put whether or not the row has something to explain.
  words: {
    flex: 1,
  },
  infinitive: {
    ...serif(22),
  },
  hint: {
    ...mono(11),
    marginTop: 2,
  },
  /*
   * The column of marks is nudged as one, so the tick and the ring keep a
   * single centre between them:
   *
   * * down 1.5, onto the row's chevron rather than its middle. Measured on the
   *   web build, the tick's ink centre sat 0.4pt above the ›'s, and it still
   *   read high — a check's mass lies in its long upstroke — so the tick lands
   *   a hair below the ›'s centre, which is where a hand-drawn one sits.
   * * in 1.5, so the tick does not crowd the › it has to be read against; the
   *   chevron's own 8pt margin is what is left of that gap.
   *
   * Both are relative offsets, so neither moves the chevron nor the row.
   */
  mark: {
    width: 18,
    height: 18,
    top: 1.5,
    left: -1.5,
  },
  /*
   * The tick is two borders of one box, turned 45° — drawn rather than typed,
   * because a ✓ is a font's opinion and both faces here are Latin or hanzi.
   *
   * The placement is arithmetic, not taste: a 7x12 box rotated about its
   * centre has its ink spanning y -1.8..6.7, i.e. ~2.5 below the box's own
   * centre, so the box is parked 2.5 above the middle of its 18pt slot and the
   * ink lands on that middle — which is where the › beside it sits. The
   * column's own 1.5pt nudge is then what tips the tick a hair past the ›, as a
   * hand-drawn one is.
   */
  tick: {
    position: 'absolute',
    left: 5.5,
    top: 0.5,
    width: 7,
    height: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.terracottaSoft,
    transform: [{ rotate: '45deg' }],
  },
  /** Still open: a ring, thinner and quieter than the tick it is waiting for. */
  openRow: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.inkSecondary,
    opacity: 0.5,
  },
  chevron: {
    ...serif(18, { color: colors.line }),
    marginLeft: 8,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ROW_COUNT, Verb } from '../types';
import { filledCount } from '../domain/verbs';
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
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
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
      <Text style={styles.progress}>
        {filledCount(verb)} / {ROW_COUNT}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...cardSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
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
  // The headword and its hint share the slack, so the count and the chevron
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
  progress: {
    ...mono(11),
  },
  chevron: {
    ...serif(18, { color: colors.line }),
    marginLeft: 8,
  },
});

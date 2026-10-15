import { Pressable, StyleSheet, Text } from 'react-native';
import { ROW_COUNT, Verb } from '../types';
import { filledCount } from '../domain/verbs';
import { cardSurface, colors, mono, serif } from '../theme';

type Props = {
  verb: Verb;
  onPress: () => void;
  onLongPress: () => void;
  /** True while this row is the one being dragged. */
  dragging?: boolean;
};

export function VerbRow({
  verb,
  onPress,
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
      <Text style={styles.infinitive} numberOfLines={1}>
        {verb.infinitive}
      </Text>
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
  infinitive: {
    ...serif(22),
    flex: 1,
  },
  progress: {
    ...mono(11),
  },
  chevron: {
    ...serif(18, { color: colors.line }),
    marginLeft: 8,
  },
});

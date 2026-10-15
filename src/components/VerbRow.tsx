import { Pressable, StyleSheet, Text } from 'react-native';
import { ROW_COUNT, Verb } from '../types';
import { filledCount } from '../domain/verbs';
import { cardSurface, colors, mono, serif } from '../theme';

type Props = {
  verb: Verb;
  onPress: () => void;
  onLongPress: () => void;
};

export function VerbRow({ verb, onPress, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
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

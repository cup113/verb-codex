import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConjugationRow, pronounFor } from '../types';
import { colors, mono } from '../theme';
import { copy } from '../copy';

const MAX_FIELD = 30;

type Props = {
  rowIndex: number;
  row: ConjugationRow;
  editing: boolean;
  revealed: boolean;
  onReveal: () => void;
  onChangeStem: (text: string) => void;
  onChangeEnding: (text: string) => void;
};

/**
 * One pronoun slot. Both halves are plain recorded text; in self-test the row
 * turns read-only and only the ending hides behind a mask.
 */
export function ConjugationRowView({
  rowIndex,
  row,
  editing,
  revealed,
  onReveal,
  onChangeStem,
  onChangeEnding,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.row}>
      <Text style={styles.pronoun} numberOfLines={1}>
        {pronounFor(rowIndex, row.stem)}
      </Text>
      {editing ? (
        <View style={[styles.box, focused && styles.boxFocused]}>
          <TextInput
            style={[styles.input, styles.stemInput]}
            value={row.stem}
            onChangeText={onChangeStem}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={MAX_FIELD}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            underlineColorAndroid="transparent"
          />
          <TextInput
            style={[styles.input, styles.endingInput]}
            value={row.ending}
            onChangeText={onChangeEnding}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={copy.masked}
            placeholderTextColor={colors.line}
            maxLength={MAX_FIELD}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            underlineColorAndroid="transparent"
          />
        </View>
      ) : (
        <Pressable style={styles.box} onPress={onReveal} hitSlop={4}>
          <Text style={styles.stemText} numberOfLines={1}>
            {row.stem}
          </Text>
          <Text style={styles.endingText} numberOfLines={1}>
            {revealed ? row.ending : copy.masked}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  pronoun: {
    ...mono(12.5),
    width: 108,
    paddingRight: 12,
    textAlign: 'right',
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    borderStyle: 'dashed',
    paddingVertical: 2,
  },
  boxFocused: {
    borderBottomColor: colors.terracotta,
  },
  input: {
    ...mono(15, { color: colors.ink }),
    padding: 0,
    margin: 0,
  },
  stemInput: {
    flexShrink: 1,
    // An empty TextInput measures to zero width, which would leave the stem
    // with no tap target at all on a freshly recorded row.
    minWidth: 28,
  },
  endingInput: {
    flexGrow: 1,
    flexBasis: 0,
    color: colors.terracotta,
  },
  stemText: {
    ...mono(15, { color: colors.ink }),
    flexShrink: 1,
  },
  endingText: {
    ...mono(15, { color: colors.terracotta }),
    flexGrow: 1,
    flexBasis: 0,
  },
});

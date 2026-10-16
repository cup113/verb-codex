import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, mono } from '../theme';
import { copy } from '../copy';

const MAX_FIELD = 30;

type Props = {
  /**
   * The stem the six rows agree on, or `null` when they differ. A `null` shows
   * the "variable" placeholder: the field never pretends to hold one row's
   * value while the others say something else.
   */
  stem: string | null;
  /** Read-only in self-test, like the rows below it. */
  editing: boolean;
  onChange: (text: string) => void;
};

/**
 * The entry's radical, written once and handed to all six rows.
 *
 * It is a bulk edit of the stems those rows already record — never a seventh
 * row and never a value the codex derived: every row keeps its own stem and
 * stays editable on its own, and the endings are not touched. The label sits in
 * the pronoun column so it reads as the head of the stem column.
 *
 * Like `ConjugationRowView`, the row stays put in self-test and only sheds its
 * field: entering the recall mode must not move the card, and the radical is
 * given there anyway — only the endings get hidden.
 */
export function RadicalField({ stem, editing, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  const mixed = stem === null;

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {copy.radical}
      </Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        {editing ? (
          <TextInput
            style={styles.input}
            value={stem ?? ''}
            onChangeText={onChange}
            placeholder={mixed ? copy.radicalMixed : copy.radicalPlaceholder}
            placeholderTextColor={colors.line}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={MAX_FIELD}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            underlineColorAndroid="transparent"
          />
        ) : (
          <Text
            style={[styles.recorded, mixed && styles.recordedMixed]}
            numberOfLines={1}
          >
            {stem ?? copy.radicalMixed}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  label: {
    ...mono(12.5),
    width: 108,
    paddingRight: 12,
    textAlign: 'right',
  },
  // The same focused dashed underline the conjugation rows carry, so the field
  // belongs to the grid rather than floating above it.
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
  // `flex: 1` also keeps the web honest: a bare <input> left to itself would
  // take the browser's default field width instead of the row's.
  input: {
    ...mono(15, { color: colors.ink }),
    flex: 1,
    padding: 0,
    margin: 0,
  },
  // The same text the field holds, laid out where the field was: self-test
  // keeps the card still instead of moving a row away.
  recorded: {
    ...mono(15, { color: colors.ink }),
    flexShrink: 1,
  },
  recordedMixed: {
    color: colors.line,
  },
});

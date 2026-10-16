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
  onChangeForm: (text: string) => void;
};

/**
 * One pronoun slot. The form is one recorded word in one colour — the codex
 * keeps no split between a stem and an ending; in self-test the row turns
 * read-only and the whole form hides behind a mask.
 */
export function ConjugationRowView({
  rowIndex,
  row,
  editing,
  revealed,
  onReveal,
  onChangeForm,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.row}>
      <Text style={styles.pronoun} numberOfLines={1}>
        {pronounFor(rowIndex, row.form)}
      </Text>
      {editing ? (
        <View style={[styles.box, focused && styles.boxFocused]}>
          <TextInput
            style={[styles.input, styles.formInput]}
            value={row.form}
            onChangeText={onChangeForm}
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
          <Text style={styles.formText} numberOfLines={1}>
            {revealed ? row.form : copy.masked}
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
  // `flex: 1` also keeps the web honest: a bare <input> left to itself would
  // take the browser's default field width instead of the row's.
  input: {
    ...mono(15, { color: colors.terracotta }),
    padding: 0,
    margin: 0,
  },
  formInput: {
    flex: 1,
    // The same web-only floor the list's fields carry: without it a narrow
    // phone gives the input less room than the browser's default field width
    // and the row overflows instead of the field shrinking.
    minWidth: 0,
  },
  // The whole recorded word, one colour: no stem/ending two-tone. It keeps the
  // ending's terracotta, so the word does not change colour between editing
  // and self-test.
  formText: {
    ...mono(15, { color: colors.terracotta }),
    flexGrow: 1,
    flexBasis: 0,
  },
});

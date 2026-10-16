import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { copy } from '../copy';
import { colors, serif } from '../theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
};

const MAX_QUERY = 40;

/**
 * The list's one search field. It filters what is on show and records nothing:
 * the codex keeps no history and no stored query.
 *
 * Its own ✕ rather than `clearButtonMode`, which iOS would paint beside this
 * one — a field with two crosses is a field nobody trusts.
 */
export function SearchField({ value, onChangeText, onClear }: Props) {
  return (
    <View style={styles.field}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={copy.searchPlaceholder}
        placeholderTextColor={colors.line}
        maxLength={MAX_QUERY}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="search"
        underlineColorAndroid="transparent"
      />
      {value === '' ? null : (
        <Pressable onPress={onClear} hitSlop={10} style={styles.clear}>
          <Text style={styles.clearLabel}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 16,
  },
  // `flex: 1` also keeps the web honest: a bare <input> left to itself would
  // take the browser's default field width instead of the row's.
  input: {
    ...serif(17),
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  clear: {
    paddingVertical: 4,
    paddingLeft: 12,
  },
  clearLabel: {
    ...serif(14, { color: colors.inkSecondary }),
  },
});

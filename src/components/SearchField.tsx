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
 * A filled box rather than another rule: it sits directly under the group
 * tabs, whose underline is already a rule, and two rules stacked an inch apart
 * read as a mistake rather than as structure. The fill also says "control",
 * where the tab strip says "index".
 *
 * Its own ✕ rather than `clearButtonMode`, which iOS would paint beside this
 * one — a field with two crosses is a field nobody trusts.
 */
export function SearchField({ value, onChangeText, onClear }: Props) {
  return (
    <View style={styles.field}>
      <Magnifier />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={copy.searchPlaceholder}
        // Darker than the placeholders on the bare-paper fields: the light
        // `colors.line` that reads as a whisper on paper disappears entirely
        // on a filled box.
        placeholderTextColor={colors.inkSecondary}
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

/**
 * A magnifier, drawn from a ring and a turned bar.
 *
 * Not a ⌕ or an emoji: a glyph is one font's opinion and would change shape
 * with whatever ends up handling it, while these two Views look the same on
 * both platforms as the list's tick does.
 */
function Magnifier() {
  return (
    <View style={styles.magnifier}>
      <View style={styles.lens} />
      <View style={styles.handle} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  input: {
    ...serif(17),
    flex: 1,
    // On the web an <input> carries the browser's default field width as its
    // own minimum and refuses to shrink below it; native has no such floor.
    minWidth: 0,
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
  magnifier: {
    width: 15,
    height: 15,
    marginRight: 9,
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: colors.inkSecondary,
    opacity: 0.55,
  },
  /*
   * Placed by arithmetic, not by eye: the lens is an 11pt circle, so the point
   * where the handle leaves it lies at (9.4, 9.4); the 5pt handle is centred
   * half its own length further along that diagonal, at (11.2, 11.2), which
   * puts its unrotated top-left corner at (8.7, 10.4).
   */
  handle: {
    position: 'absolute',
    left: 8.7,
    top: 10.4,
    width: 5,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.inkSecondary,
    opacity: 0.55,
    transform: [{ rotate: '45deg' }],
  },
});

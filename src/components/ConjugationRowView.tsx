import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  // Only the web needs this; it stays null where the platform measures the
  // field by its text itself.
  const [stemWidth, setStemWidth] = useState<number | null>(null);
  const webLayout = Platform.OS === 'web';

  return (
    <View style={styles.row}>
      <Text style={styles.pronoun} numberOfLines={1}>
        {pronounFor(rowIndex, row.stem)}
      </Text>
      {editing ? (
        <View style={[styles.box, focused && styles.boxFocused]}>
          {webLayout ? (
            // A bare <input> has no content width: left to itself it takes the
            // browser's default field width — some twenty characters — which
            // drags the ending a third of the row away from its stem. Native
            // measures the field by its text, so this copy exists only where
            // the platform does not.
            //
            // Until it has reported a width it *is* the stem, laid out in
            // place exactly as the read-only row lays it out, so even the first
            // paint is right; afterwards it steps behind the field as an
            // invisible copy that keeps reporting as the text changes.
            <Text
              style={
                stemWidth === null
                  ? styles.stemText
                  : [styles.stemText, styles.measure]
              }
              numberOfLines={1}
              accessible={false}
              onLayout={event =>
                setStemWidth(Math.ceil(event.nativeEvent.layout.width))
              }
            >
              {row.stem || ' '}
            </Text>
          ) : null}
          {webLayout && stemWidth === null ? null : (
            <TextInput
              style={[
                styles.input,
                styles.stemInput,
                // Two pixels of slack keep the caret off the ending's first
                // letter without a visible gap.
                stemWidth !== null && { width: stemWidth + 2 },
              ]}
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
          )}
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
    // The measuring copy below anchors here; native already defaults to this.
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    borderStyle: 'dashed',
    paddingVertical: 2,
  },
  boxFocused: {
    borderBottomColor: colors.terracotta,
  },
  // Invisible, but still laid out — `opacity`, never `display`, so onLayout
  // keeps reporting the width of the text it holds.
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
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

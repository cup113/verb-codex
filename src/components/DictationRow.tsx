import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CheckedRow } from '../domain/dictation';
import { colors, mono } from '../theme';
import { copy } from '../copy';

const MAX_FIELD = 30;
const SETTLE_MS = 320;

type Props = {
  /** The pronoun facing the row — fixed from the recorded word, as in self-test. */
  pronoun: string;
  /** What the user has typed for this row so far. */
  value: string;
  /** This row's verdict; `null` while the paper is unchecked. */
  verdict: CheckedRow;
  /** A flawless paper inks its rows one after another; this is the row's turn. */
  settleDelay: number;
  onChange: (text: string) => void;
};

/**
 * One row of a dictation: an empty field waiting for the word, a struck-through
 * attempt once the check called it wrong, or the word inked in for good once it
 * matched. The codex marks faults the way a teacher does — the wrong word is
 * crossed out, the right one just settles into ink — and it never says which
 * letter was wrong, because the whole word is the unit it compares.
 */
export function DictationRow({
  pronoun,
  value,
  verdict,
  settleDelay,
  onChange,
}: Props) {
  // A row that mounts already settled starts inked: the animation is for the
  // moment a check lands, not for every later render.
  const settle = useRef(new Animated.Value(verdict === 'ok' ? 1 : 0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (verdict !== 'ok') {
      return;
    }
    Animated.timing(settle, {
      toValue: 1,
      duration: SETTLE_MS,
      delay: settleDelay,
      easing: Easing.out(Easing.cubic),
      // The JS driver on purpose: these are two micro-animations on a card the
      // user is already looking at, and the native one needs the animated
      // module to hand a view to, which the test renderer has not got.
      useNativeDriver: false,
    }).start();
  }, [verdict, settle, settleDelay]);

  useEffect(() => {
    if (verdict !== 'bad') {
      return;
    }
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: false }),
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: false }),
      Animated.timing(shake, { toValue: -0.5, duration: 50, useNativeDriver: false }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: false }),
    ]).start();
  }, [verdict, shake]);

  const fieldStyle = useMemo(
    () => ({
      transform: [
        {
          translateX: shake.interpolate({
            inputRange: [-1, 1],
            outputRange: [-4, 4],
          }),
        },
      ],
    }),
    [shake],
  );

  const settleStyle = useMemo(
    () => ({
      opacity: settle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
      transform: [
        {
          translateY: settle.interpolate({
            inputRange: [0, 1],
            outputRange: [3, 0],
          }),
        },
      ],
    }),
    [settle],
  );

  const wrong = verdict === 'bad';
  const struck = wrong && value.trim() !== '';

  return (
    <View style={styles.row}>
      <Text style={styles.pronoun} numberOfLines={1}>
        {pronoun}
      </Text>
      <Animated.View
        style={[styles.box, wrong && styles.boxWrong, fieldStyle]}
      >
        {verdict === 'ok' ? (
          <Animated.View style={[styles.settledRow, settleStyle]}>
            <Text style={styles.settled} numberOfLines={1}>
              {value.trim()}
            </Text>
          </Animated.View>
        ) : (
          <TextInput
            style={[styles.input, struck && styles.struck]}
            value={value}
            onChangeText={onChange}
            placeholder={copy.masked}
            placeholderTextColor={colors.line}
            maxLength={MAX_FIELD}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            underlineColorAndroid="transparent"
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  // Same geometry as a recorded row: the card must not move when the words
  // are replaced by empty fields.
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
  // A wrong row keeps a visible line under it: on an empty field there is no
  // word to cross out, and the row still has to say it is not done.
  boxWrong: {
    borderBottomColor: colors.terracotta,
  },
  input: {
    ...mono(15, { color: colors.terracotta }),
    flex: 1,
    // The same web-only floor the recording field carries: without it a narrow
    // phone gives the input less room than the browser's default field width.
    minWidth: 0,
    padding: 0,
    margin: 0,
  },
  // The user's own attempt, crossed out where the check found it wrong. It
  // stays editable: correcting it is the second half of the exercise.
  struck: {
    textDecorationLine: 'line-through',
  },
  settledRow: {
    flex: 1,
  },
  settled: {
    ...mono(15, { color: colors.ink }),
  },
});

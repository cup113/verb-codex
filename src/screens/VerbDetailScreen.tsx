import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { ConjugationRowView } from '../components/ConjugationRowView';
import { DictationRow } from '../components/DictationRow';
import { VerdictStamp } from '../components/VerdictStamp';
import { OutlinedButton } from '../components/OutlinedButton';
import { useArmedConfirm } from '../components/useArmedConfirm';
import { useBlurFocusedInputOnKeyboardHide } from '../platform/blurOnKeyboardHide';
import { copy } from '../copy';
import { cardSurface, colors, fonts, mono, serif } from '../theme';
import { verbStore, useVerbState } from '../storage/verbStore';
import {
  Group,
  GROUPS,
  GROUP_BACK_LABELS,
  GROUP_TAB_LABELS,
  ROW_COUNT,
  pronounFor,
} from '../types';
import { isComplete } from '../domain/verbs';
import {
  finishedOf,
  reveal,
  startDictation,
  startSelfTest,
  verify,
  write,
  type Exercise,
} from '../domain/exercise';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbDetail'>;

/**
 * A flawless paper inks its six rows one after another, then stamps.
 */
const SETTLE_STAGGER_MS = 90;
const STAMP_LAG_MS = 200;

export function VerbDetailScreen({ route, navigation }: Props) {
  const { verbs } = useVerbState();
  const verb = verbs.find(item => item.id === route.params.verbId);
  /**
   * What the card is doing, if anything: `null` is the card at rest. Every
   * exercise replaces this value wholesale, which is also why leaving one needs
   * no clearing — an attempt cannot be kept, because there is nowhere to keep
   * it but here.
   */
  const [exercise, setExercise] = useState<Exercise | null>(null);
  /**
   * The corner's second question: the group the entry is being moved to. Only
   * one question is ever live at once — arming the delete folds this away, and
   * opening this disarms the delete.
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * The corner's first question, asked in place and withdrawn on its own: two
   * touches, no dialog. The entry it deletes is the one this screen was opened
   * for, so the callback names the route's id rather than looking the entry up
   * again — and it can be declared before the entry is known to exist.
   */
  const {
    armed: deleteArmed,
    press: pressDelete,
    disarm: disarmDelete,
  } = useArmedConfirm(
    () => {
      // Leaving the entry that no longer exists would show an empty screen.
      verbStore.removeVerb(route.params.verbId).then(navigation.goBack);
    },
    { onArm: () => setPickerOpen(false) },
  );
  useBlurFocusedInputOnKeyboardHide();

  // Every exercise is left through here: dropping the value drops the attempt
  // with it, so leaving the card and coming back starts a fresh paper. The
  // codex keeps recorded words, never attempts at them.
  const leave = () => setExercise(null);

  // Android back leaves an exercise before it leaves the entry, and drops a
  // question the corner is still asking before that. There is no hardware key
  // on the web, and react-native-web's stub only logs an error.
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (exercise !== null) {
          setExercise(null);
          return true;
        }
        if (pickerOpen || deleteArmed) {
          setPickerOpen(false);
          disarmDelete();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [exercise, pickerOpen, deleteArmed, disarmDelete]);

  // The way back names the group the list behind is standing in — the group it
  // was opened from, not necessarily the one the entry stands in now: an entry
  // can be moved while its screen is up, and the way back still goes to the
  // list it came from. An entry that is already gone (deleted while its screen
  // was still up) has no group left to name, so it falls back to the plain word.
  const backGroup = route.params.group ?? verb?.group;
  const back = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={10}
      style={styles.backRow}
    >
      <Text style={styles.back}>
        {copy.backTo(
          backGroup ? GROUP_BACK_LABELS[backGroup] : copy.backFallback,
        )}
      </Text>
    </Pressable>
  );

  if (!verb) {
    return <Screen>{back}</Screen>;
  }

  const togglePicker = () => {
    // The picker and an armed delete are two questions under one thumb.
    disarmDelete();
    setPickerOpen(open => !open);
  };

  // Recording a group is a rewrite of the entry and takes effect at once, with
  // no confirmation: unlike a delete, it is undone by moving the entry back.
  const moveTo = (group: Group) => {
    setPickerOpen(false);
    if (group !== verb.group) {
      verbStore.setGroup(verb.id, group);
    }
  };

  /**
   * The exercise being played, as a dictation — `null` for the card at rest and
   * for a self-test, which shares none of a paper's state.
   */
  const dictation = exercise?.kind === 'dictation' ? exercise : null;
  /** The six recorded words a paper would be graded against, right now. */
  const recorded = verb.rows.map(row => row.form);
  const complete = isComplete(verb);
  const finished = exercise !== null && finishedOf(exercise);
  const flawless = dictation !== null && dictation.flawless;
  const anyWrong = dictation !== null && dictation.verdicts.includes('bad');

  const buttons =
    exercise === null
      ? [
          <OutlinedButton
            key="write"
            label={copy.dictate}
            onPress={() => setExercise(startDictation(recorded))}
            disabled={!complete}
          />,
          <OutlinedButton
            key="test"
            label={copy.selfTest}
            tone="terracotta"
            onPress={() => setExercise(startSelfTest())}
          />,
        ]
      : exercise.kind === 'selfTest'
      ? [
          // The rows are all readable again on the way out, which is what the
          // word promises: this ends the exercise rather than unmasking six
          // rows one at a time.
          <OutlinedButton
            key="reveal"
            label={copy.revealAll}
            onPress={leave}
          />,
        ]
      : finished
      ? [
          <OutlinedButton
            key="again"
            label={copy.again}
            onPress={() => setExercise(startDictation(recorded))}
          />,
          <OutlinedButton
            key="proceed"
            label={copy.proceed}
            tone="terracotta"
            onPress={leave}
          />,
        ]
      : [
          <OutlinedButton key="quit" label={copy.quit} onPress={leave} />,
          <OutlinedButton
            key="verify"
            label={copy.verify}
            tone="terracotta"
            onPress={() => setExercise(current => current && verify(current))}
          />,
        ];

  const tip =
    exercise === null
      ? copy.tip
      : exercise.kind === 'selfTest'
      ? copy.tipLocked
      : finished
      ? ''
      : anyWrong
      ? copy.tipCorrect
      : copy.tipWrite;

  return (
    // Edge-to-edge: without this the body keeps full height behind the IME,
    // the card fits inside it, and the last rows cannot be scrolled into view.
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <View style={styles.actions}>
            <Text style={styles.tip} numberOfLines={2}>
              {tip}
            </Text>
            <View style={styles.buttonRow}>{buttons}</View>
          </View>
        }
      >
        <View style={styles.topRow}>
          {back}
          <View style={styles.corner}>
            <Pressable
              onPress={togglePicker}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={copy.move}
              // The platform-neutral spelling; react-native-web reads this one
              // and would drop an `accessibilityState` object.
              aria-expanded={pickerOpen}
              style={styles.cornerAction}
            >
              <Text
                style={[styles.moveLabel, pickerOpen && styles.moveLabelOpen]}
              >
                {copy.move}
              </Text>
            </Pressable>
            <Pressable
              onPress={pressDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                deleteArmed ? copy.deleteArmedHint : copy.delete
              }
              style={styles.cornerAction}
            >
              <Text
                style={
                  deleteArmed ? styles.deleteArmedLabel : styles.deleteLabel
                }
              >
                {deleteArmed ? copy.deleteSure : copy.delete}
              </Text>
            </Pressable>
          </View>
        </View>
        {pickerOpen ? (
          <GroupPicker active={verb.group} onPick={moveTo} />
        ) : null}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {exercise !== null ? (
                <Text style={styles.infinitiveText} numberOfLines={1}>
                  {verb.infinitive}
                </Text>
              ) : (
                <TextInput
                  style={styles.infinitiveInput}
                  value={verb.infinitive}
                  onChangeText={text => verbStore.setInfinitive(verb.id, text)}
                  maxLength={40}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  underlineColorAndroid="transparent"
                />
              )}
              <Text style={styles.tense}>{copy.tense}</Text>
            </View>
            <View style={styles.grid}>
              {/* One recorded word per pronoun, all in one colour. Self-test
                  keeps every row in place and only makes it read-only; a
                  dictation empties the fields and fills them back in the
                  user's own hand — the card must not move either way. */}
              {dictation !== null
                ? verb.rows.map((row, index) => (
                    <DictationRow
                      key={index}
                      pronoun={pronounFor(index, row.form)}
                      // A finished paper shows the recorded words back, inked;
                      // until then the row shows what the user typed.
                      value={
                        finished
                          ? dictation.recorded[index]
                          : dictation.typed[index]
                      }
                      verdict={dictation.verdicts[index] ?? null}
                      settleDelay={flawless ? index * SETTLE_STAGGER_MS : 0}
                      onChange={text =>
                        setExercise(current =>
                          current === null
                            ? current
                            : write(current, index, text),
                        )
                      }
                    />
                  ))
                : verb.rows.map((row, index) => (
                    <ConjugationRowView
                      key={index}
                      rowIndex={index}
                      row={row}
                      editing={exercise === null}
                      revealed={
                        exercise?.kind === 'selfTest' &&
                        exercise.revealed.has(index)
                      }
                      onReveal={() =>
                        setExercise(current =>
                          current === null ? current : reveal(current, index),
                        )
                      }
                      onChangeForm={text =>
                        verbStore.setRow(verb.id, index, { form: text })
                      }
                    />
                  ))}
            </View>
            {finished ? (
              <View style={styles.verdictArea}>
                <VerdictStamp
                  tier={flawless ? 'flawless' : 'corrected'}
                  delay={
                    flawless
                      ? ROW_COUNT * SETTLE_STAGGER_MS + STAMP_LAG_MS
                      : STAMP_LAG_MS
                  }
                />
              </View>
            ) : null}
          </View>
          {exercise === null ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteLabel}>{copy.noteLabel}</Text>
              <TextInput
                style={styles.noteInput}
                value={verb.note}
                onChangeText={text => verbStore.setNote(verb.id, text)}
                placeholder={copy.notePlaceholder}
                placeholderTextColor={colors.line}
                multiline
                textAlignVertical="top"
                maxLength={2000}
                autoCorrect
                underlineColorAndroid="transparent"
              />
            </View>
          ) : null}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * The three groups, hung under the corner in the library tabs' own language:
 * the group the entry stands in is underlined in terracotta. A row rather than
 * a dialog, so the entry being moved stays in sight while it is moved, and the
 * move itself takes one touch instead of two.
 */
function GroupPicker({
  active,
  onPick,
}: {
  active: Group;
  onPick: (group: Group) => void;
}) {
  return (
    <View style={styles.picker}>
      {GROUPS.map(group => {
        const selected = group === active;
        return (
          <Pressable
            key={group}
            onPress={() => onPick(group)}
            hitSlop={8}
            accessibilityRole="button"
            // `aria-selected` rather than `accessibilityState={{ selected }}`,
            // for the reason MoreButton gives: both platforms read this one,
            // and react-native-web would drop the state object.
            aria-selected={selected}
            style={styles.pickerTab}
          >
            <Text
              style={[styles.pickerLabel, selected && styles.pickerLabelActive]}
            >
              {GROUP_TAB_LABELS[group]}
            </Text>
            {selected ? <View style={styles.pickerUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backRow: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  // The corner's two actions read as one cluster: the move, then the delete
  // that has to be asked for twice.
  corner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cornerAction: {
    paddingVertical: 6,
  },
  moveLabel: {
    ...serif(14, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  // While its picker is out, the trigger reads as the thing that is on.
  moveLabelOpen: {
    fontFamily: fonts.serifMedium,
    color: colors.ink,
  },
  deleteLabel: {
    ...serif(14, { fontFamily: fonts.serifItalic, color: colors.terracotta }),
  },
  // The question, written where the word was: upright and underlined, as if
  // pressed into the paper — a different hand from the idle label's.
  deleteArmedLabel: {
    ...serif(14, {
      fontFamily: fonts.serifMedium,
      color: colors.terracotta,
      textDecorationLine: 'underline',
    }),
  },
  // Hung under the corner it belongs to rather than centred on the sheet: this
  // row is the tail of the trigger above it, not a section of its own.
  picker: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: -6,
    marginBottom: 12,
  },
  // No horizontal padding, so the last word ends flush with « Supprimer » above
  // it and the rule under the group on show brackets the word itself rather
  // than the space beside it. `hitSlop` keeps each touch target generous.
  pickerTab: {
    paddingVertical: 4,
  },
  pickerLabel: {
    ...serif(15, { color: colors.inkSecondary, fontFamily: fonts.serifItalic }),
  },
  pickerLabelActive: {
    fontFamily: fonts.serifMedium,
    color: colors.ink,
  },
  // The same terracotta rule the library tabs draw under the group on show.
  pickerUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.terracotta,
  },
  back: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  scroll: {
    paddingBottom: 16,
  },
  card: {
    ...cardSurface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    paddingBottom: 12,
    marginBottom: 18,
    gap: 12,
  },
  infinitiveText: {
    ...serif(24, { letterSpacing: 0.5 }),
    flexShrink: 1,
  },
  infinitiveInput: {
    ...serif(24, { letterSpacing: 0.5 }),
    flex: 1,
    // Only the web needs this: an <input> there will not shrink below the
    // browser's default field width, which squeezed "Présent" into a box
    // narrower than its own text and pushed the last letters past the card.
    minWidth: 0,
    padding: 0,
    margin: 0,
  },
  tense: {
    ...mono(11, { letterSpacing: 1, textTransform: 'uppercase' }),
    // The label is a fixed seven letters and must never be the thing that
    // gives way: the field beside it shrinks instead.
    flexShrink: 0,
  },
  grid: {
    gap: 12,
  },
  // Where the stamp lands: reserved whether or not a paper is finished, so the
  // card does not jump the moment the last word settles.
  verdictArea: {
    marginTop: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    ...cardSurface,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  noteLabel: {
    ...mono(10, { letterSpacing: 1.2, textTransform: 'uppercase' }),
    marginBottom: 8,
  },
  // Prose, so the serif rather than the grid's mono; no fixed height, it
  // grows with the note and the screen's ScrollView does the scrolling.
  noteInput: {
    ...serif(15, { lineHeight: 22 }),
    minHeight: 96,
    padding: 0,
    margin: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // The hint gives way before the buttons do: it is a remark, they are the
  // only way forward. Two of them sit in the footer now, not one.
  tip: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    flex: 1,
    paddingRight: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
});

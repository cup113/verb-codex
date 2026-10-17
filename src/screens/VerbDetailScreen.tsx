import { useCallback, useEffect, useRef, useState } from 'react';
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
import { checkPaper } from '../domain/dictation';
import type { CheckedRow } from '../domain/dictation';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbDetail'>;

/**
 * What the card is doing. The words on it are the same six rows throughout —
 * only what they can do changes, so the card never moves.
 */
type Mode = 'view' | 'test' | 'write' | 'done';

/** A flawless paper inks its six rows one after another, then stamps. */
const SETTLE_STAGGER_MS = 90;
const STAMP_LAG_MS = 200;

/**
 * How long the corner stays armed after the first touch on « Supprimer »: long
 * enough to read the question and answer it, short enough that a stray touch
 * never leaves a live delete sitting under the thumb.
 */
const DELETE_ARMED_MS = 3000;

const blankInputs = (): string[] =>
  Array.from({ length: ROW_COUNT }, () => '');

const blankVerdicts = (): CheckedRow[] =>
  Array.from({ length: ROW_COUNT }, () => null);

export function VerbDetailScreen({ route, navigation }: Props) {
  const { verbs } = useVerbState();
  const verb = verbs.find(item => item.id === route.params.verbId);
  const [mode, setMode] = useState<Mode>('view');
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  /** The words typed for a dictation, one per row; empty outside one. */
  const [typed, setTyped] = useState<string[]>(blankInputs);
  const [checked, setChecked] = useState<CheckedRow[]>(blankVerdicts);
  /**
   * Whether the paper was flawless when it was first checked. A round that
   * needed correcting keeps this false to the end, so its stamp is the lesser
   * one — see ADR 0002.
   */
  const [flawless, setFlawless] = useState(false);
  /**
   * The corner's two pending questions: a delete waiting for its second touch,
   * and the group the entry is being moved to. Only one is ever live at once.
   */
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const armedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useBlurFocusedInputOnKeyboardHide();

  // The armed corner must not outlive the screen: a timer still running would
  // fire a state update on a card that is already gone.
  useEffect(() => {
    return () => {
      if (armedTimer.current !== null) {
        clearTimeout(armedTimer.current);
        armedTimer.current = null;
      }
    };
  }, []);

  // Every exercise is left through here: nothing typed in a dictation is kept,
  // so leaving the card and coming back starts a fresh paper. The codex keeps
  // recorded words, never attempts at them.
  const exitToView = useCallback(() => {
    setMode('view');
    setRevealed(new Set<number>());
    setTyped(blankInputs());
    setChecked(blankVerdicts());
    setFlawless(false);
  }, []);

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
        if (mode !== 'view') {
          exitToView();
          return true;
        }
        if (pickerOpen || deleteArmed) {
          setPickerOpen(false);
          setDeleteArmed(false);
          if (armedTimer.current !== null) {
            clearTimeout(armedTimer.current);
            armedTimer.current = null;
          }
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [mode, exitToView, pickerOpen, deleteArmed]);

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

  /** Stops the countdown without touching what the corner is showing. */
  const clearArmed = () => {
    if (armedTimer.current !== null) {
      clearTimeout(armedTimer.current);
      armedTimer.current = null;
    }
  };

  /**
   * Two touches, no dialog: the corner asks its question in place, on the paper
   * the entry is written on, rather than in a box laid over it. The first touch
   * arms the button, the second one does the deed, and the timer disarms a
   * question that was never answered.
   */
  const pressDelete = () => {
    if (!deleteArmed) {
      // One question at a time in the corner.
      setPickerOpen(false);
      setDeleteArmed(true);
      clearArmed();
      armedTimer.current = setTimeout(() => {
        armedTimer.current = null;
        setDeleteArmed(false);
      }, DELETE_ARMED_MS);
      return;
    }
    clearArmed();
    // Leaving the entry that no longer exists would show an empty screen.
    verbStore.removeVerb(verb.id).then(navigation.goBack);
  };

  const togglePicker = () => {
    // The picker and an armed delete are two questions under one thumb.
    clearArmed();
    setDeleteArmed(false);
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

  const reveal = (index: number) => {
    setRevealed(previous => {
      const next = new Set(previous);
      next.add(index);
      return next;
    });
  };

  const enterTest = () => {
    setRevealed(new Set<number>());
    setMode('test');
  };

  const enterWrite = () => {
    setTyped(blankInputs());
    setChecked(blankVerdicts());
    setFlawless(false);
    setMode('write');
  };

  const changeDictation = (index: number, text: string) => {
    setTyped(previous =>
      previous.map((word, i) => (i === index ? text : word)),
    );
    // Editing a crossed-out row withdraws its verdict: the next check judges
    // the corrected word on its own, and the strike goes with the verdict.
    setChecked(previous =>
      previous.map((verdict, i) =>
        i === index && verdict === 'bad' ? null : verdict,
      ),
    );
  };

  const verify = () => {
    const result = checkPaper({
      inputs: typed,
      recorded: verb.rows.map(row => row.form),
      previous: checked,
    });
    setChecked(result.verdicts);
    setFlawless(result.flawless);
    if (result.done) {
      setMode('done');
    }
  };

  const complete = isComplete(verb);
  const dictating = mode === 'write' || mode === 'done';
  const anyWrong = checked.includes('bad');

  const buttons =
    mode === 'view'
      ? [
          <OutlinedButton
            key="write"
            label={copy.dictate}
            onPress={enterWrite}
            disabled={!complete}
          />,
          <OutlinedButton
            key="test"
            label={copy.selfTest}
            tone="terracotta"
            onPress={enterTest}
          />,
        ]
      : mode === 'test'
      ? [
          <OutlinedButton
            key="reveal"
            label={copy.revealAll}
            onPress={exitToView}
          />,
        ]
      : mode === 'write'
      ? [
          <OutlinedButton key="quit" label={copy.quit} onPress={exitToView} />,
          <OutlinedButton
            key="verify"
            label={copy.verify}
            tone="terracotta"
            onPress={verify}
          />,
        ]
      : [
          <OutlinedButton key="again" label={copy.again} onPress={enterWrite} />,
          <OutlinedButton
            key="proceed"
            label={copy.proceed}
            tone="terracotta"
            onPress={exitToView}
          />,
        ];

  const tip =
    mode === 'view'
      ? copy.tip
      : mode === 'test'
      ? copy.tipLocked
      : mode === 'write'
      ? anyWrong
        ? copy.tipCorrect
        : copy.tipWrite
      : '';

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
              {mode !== 'view' ? (
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
              {dictating
                ? verb.rows.map((row, index) => (
                    <DictationRow
                      key={index}
                      pronoun={pronounFor(index, row.form)}
                      // A finished paper shows the recorded words back, inked;
                      // until then the row shows what the user typed.
                      value={mode === 'done' ? row.form : typed[index]}
                      verdict={checked[index] ?? null}
                      settleDelay={
                        flawless ? index * SETTLE_STAGGER_MS : 0
                      }
                      onChange={text => changeDictation(index, text)}
                    />
                  ))
                : verb.rows.map((row, index) => (
                    <ConjugationRowView
                      key={index}
                      rowIndex={index}
                      row={row}
                      editing={mode === 'view'}
                      revealed={revealed.has(index)}
                      onReveal={() => reveal(index)}
                      onChangeForm={text =>
                        verbStore.setRow(verb.id, index, { form: text })
                      }
                    />
                  ))}
            </View>
            {mode === 'done' ? (
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
          {mode === 'view' ? (
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

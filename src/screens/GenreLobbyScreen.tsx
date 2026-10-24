import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { OutlinedButton } from '../components/OutlinedButton';
import { useArmedConfirm } from '../components/useArmedConfirm';
import { copy } from '../copy';
import { colors, fonts, serif } from '../theme';
import { genreStore, useGenreState } from '../storage/genreStore';
import { boxCount, reviewCount } from '../domain/genre';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Genre'> & {
  /**
   * The clock, injected. `sitting.ts` already takes one as a parameter; a screen
   * that reaches for the ambient one cannot be told what time it is, so the
   * count it shows is not a function of its inputs.
   */
  now?: () => number;
};

/**
 * The drill's lobby: the two ways in, and what the ledger currently owes.
 *
 * It is a screen of its own rather than a first frame of the sitting because
 * its way back leads to the list, while a sitting's way back leads here — the
 * back label and the hardware back button then agree on both platforms without
 * a single handler.
 */
export function GenreLobbyScreen({ navigation, now = Date.now }: Props) {
  const { review, ready } = useGenreState();
  // Emptying the box is a destructive question asked in place, in the same two
  // touches and the same length as the entry screen's delete.
  const reset = useArmedConfirm(() => genreStore.clear());
  /**
   * What the boxes owe, read off the clock once per ledger — not once per
   * render, and not once per mount.
   *
   * Per render would let two renders of the same ledger disagree. Per mount
   * would be worse: this screen stays mounted behind a sitting, so a word that
   * went into a box while it was away is due at once, and a frozen clock would
   * never count it. Tying the read to the ledger's identity says what is meant
   * — the count is a fact about this ledger.
   */
  const due = useMemo(() => reviewCount(review, now()), [review, now]);

  if (!ready) {
    return <Screen />;
  }

  const held = boxCount(review);

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <Text style={styles.back}>{copy.backTo(copy.backFallback)}</Text>
        </Pressable>
        <Text style={styles.barTitle}>{copy.genreTitle}</Text>
      </View>
      <View style={styles.lobby}>
        <Text style={styles.lede}>{copy.genreLede}</Text>
        <OutlinedButton
          label={copy.genreStart}
          onPress={() =>
            navigation.navigate('GenreDrill', { mode: 'practice' })
          }
        />
        <OutlinedButton
          // The count is what the ledger owes right now; with an empty box the
          // button says so rather than opening a sitting with no questions.
          label={due > 0 ? copy.genreReview(due) : copy.genreReviewEmpty}
          disabled={due === 0}
          onPress={() => navigation.navigate('GenreDrill', { mode: 'review' })}
        />
        <Text style={styles.note}>{copy.genreLeitner}</Text>
      </View>
      <View style={styles.foot}>
        {held === 0 ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              reset.armed ? copy.genreResetHint : copy.genreReset(held)
            }
            onPress={reset.press}
            hitSlop={8}
          >
            <Text style={[styles.link, reset.armed && styles.linkArmed]}>
              {reset.armed ? copy.genreResetSure : copy.genreReset(held)}
            </Text>
          </Pressable>
        )}
        <Text style={styles.credit}>{copy.genreCredit}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  back: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  barTitle: {
    ...serif(16),
  },
  lobby: {
    gap: 12,
    marginTop: 8,
  },
  lede: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    marginBottom: 8,
  },
  note: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    marginTop: 6,
  },
  foot: {
    marginTop: 'auto',
    paddingTop: 24,
    gap: 6,
  },
  link: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
  },
  linkArmed: {
    color: colors.terracotta,
  },
  credit: {
    ...serif(11, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
});

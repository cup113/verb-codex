import { Pressable, StyleSheet, Text, View } from 'react-native';
import { copy } from '../copy';
import { cardSurface, colors, fonts, mono, serif } from '../theme';
import { BOX_DAYS, articleFor } from '../domain/genre';
import type { AnswerOutcome, Box, Gender } from '../domain/genre';

type Props = {
  word: string;
  /** The one Chinese line that lets the word be recognised — never the answer. */
  gloss: string;
  /** The bank's own gender for this word; the drill knows nothing else. */
  gender: Gender;
  /** What the owner chose, or null while the question is still open. */
  picked: Gender | null;
  /** What that answer did to the ledger; null while the question is open. */
  outcome: AnswerOutcome | null;
  /** The box a review question came from; null in a practice sitting. */
  reviewBox?: Box | null;
  onPick: (gender: Gender) => void;
};

/** How far off a box's next turn is, in the words the card uses. */
function dueLabel(box: Box): string {
  const days = BOX_DAYS[box];
  return days <= 0 ? copy.genreDueNow : copy.genreDueIn(days);
}

function outcomeText(outcome: AnswerOutcome): string {
  switch (outcome.kind) {
    case 'toReview':
      return copy.genreToReview;
    case 'sentBack':
      return copy.genreBoxDue(1, copy.genreDueNow);
    case 'graduated':
      return copy.genreGraduated;
    case 'advanced':
      return copy.genreBoxDue(outcome.box, dueLabel(outcome.box));
  }
}

/**
 * The question: one noun, its gloss, and two articles.
 *
 * The gloss is shown while the question is open on purpose — recognising the
 * word is not what is being asked, and in a review it is the only reminder of
 * which word came back. The French stays the largest thing on the card; the
 * two articles are the only controls, and after an answer all they do is say
 * what was right.
 */
export function GenreCard({
  word,
  gloss,
  gender,
  picked,
  outcome,
  reviewBox = null,
  onPick,
}: Props) {
  const answered = picked !== null;

  return (
    <View style={styles.card}>
      {reviewBox === null ? null : (
        <View style={styles.tags}>
          <Text style={styles.kind}>{copy.genreKind}</Text>
          <View style={styles.boxTag}>
            <Text style={styles.boxTagText}>{copy.genreBoxTag(reviewBox)}</Text>
          </View>
        </View>
      )}
      <Text style={styles.noun}>{word}</Text>
      {gloss === '' ? null : <Text style={styles.gloss}>{gloss}</Text>}
      <View style={styles.picks}>
        {(['m', 'f'] as const).map(candidate => {
          const isRight = answered && candidate === gender;
          const isWrongPick =
            answered && candidate === picked && candidate !== gender;
          return (
            <Pressable
              key={candidate}
              accessibilityRole="button"
              disabled={answered}
              onPress={() => onPick(candidate)}
              style={[
                styles.pick,
                isRight && styles.pickRight,
                isWrongPick && styles.pickWrong,
              ]}
            >
              <Text
                style={[
                  styles.pickLabel,
                  isRight && styles.pickLabelRight,
                  isWrongPick && styles.pickLabelWrong,
                ]}
              >
                {articleFor(candidate)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* One live region for the whole reveal: an answer appearing is exactly
          what a screen reader must announce, and the article is not a button. */}
      <View style={styles.feedback} accessibilityLiveRegion="polite">
        {answered ? (
          <>
            <Text style={styles.answer}>
              <Text style={styles.article}>{articleFor(gender)}</Text>
              {` ${word}`}
            </Text>
            {/* A right practice answer has nothing to add: it moved no box. */}
            {outcome === null ? null : (
              <Text
                style={[
                  styles.outcome,
                  outcome.kind === 'advanced' || outcome.kind === 'graduated'
                    ? styles.outcomeRight
                    : styles.outcomeWrong,
                ]}
              >
                {outcomeText(outcome)}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.prompt}>{copy.genrePrompt}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: 8,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 18,
    marginBottom: 16,
  },
  kind: {
    ...mono(11),
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  boxTag: {
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  boxTagText: {
    ...mono(11, { color: colors.terracotta }),
  },
  noun: {
    ...serif(40, { fontFamily: fonts.serifMedium }),
    alignSelf: 'stretch',
    textAlign: 'center',
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 6,
  },
  gloss: {
    ...serif(16, { color: colors.inkSecondary }),
    alignSelf: 'stretch',
    textAlign: 'center',
    marginBottom: 26,
  },
  picks: {
    flexDirection: 'row',
    gap: 14,
    alignSelf: 'stretch',
  },
  pick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.inkSecondary,
    borderRadius: 6,
  },
  pickRight: {
    borderColor: colors.verdictRight,
  },
  pickWrong: {
    borderColor: colors.verdictWrong,
  },
  pickLabel: {
    ...serif(26),
  },
  pickLabelRight: {
    color: colors.verdictRight,
  },
  // The article that was chosen wrongly is struck rather than removed: the
  // card keeps saying what was touched and what the answer was, side by side.
  // It is inked in the correction pen, so the two pills differ in hue as well
  // as in weight — a glance is enough on a phone held at arm's length.
  pickLabelWrong: {
    color: colors.verdictWrong,
    textDecorationLine: 'line-through',
  },
  feedback: {
    marginTop: 22,
    minHeight: 58,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  prompt: {
    ...serif(13, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  answer: {
    ...serif(20),
    textAlign: 'center',
  },
  article: {
    ...serif(20, { fontFamily: fonts.serifItalic, color: colors.verdictRight }),
  },
  outcome: {
    ...mono(11),
    marginTop: 5,
  },
  // The result line says what the answer did to the ledger, so it wears the
  // colour of that verdict: a box moved up or a word graduated is green, an
  // entry into the review box or a return to box one is terracotta.
  outcomeRight: {
    color: colors.verdictRight,
  },
  outcomeWrong: {
    color: colors.verdictWrong,
  },
});

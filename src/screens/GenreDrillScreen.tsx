import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { GenreCard } from '../components/GenreCard';
import { OutlinedButton } from '../components/OutlinedButton';
import { VerdictStamp } from '../components/VerdictStamp';
import { copy } from '../copy';
import { colors, fonts, mono, serif } from '../theme';
import { genreStore, useGenreState } from '../storage/genreStore';
import { articleFor, reviewCount } from '../domain/genre';
import type { Gender, ReviewState } from '../domain/genre';
import {
  answerSitting,
  currentQuestion,
  nextQuestion,
  paperOf,
  startSitting,
} from '../domain/sitting';
import type { Mode, Paper, Sitting } from '../domain/sitting';
import { NOUNS } from '../data/nouns';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'GenreDrill'> & {
  /** The clock, injected for the reason `draw` gives below. */
  now?: () => number;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Draw one sitting. Ambient facts are handed in rather than reached for, so the
 * rules a sitting keeps live in one place (`domain/sitting.ts`): the bank, the
 * ledger, the clock and the random stream.
 */
function draw(mode: Mode, ledger: ReviewState, at: number): Sitting {
  return startSitting({
    mode,
    ledger,
    bank: NOUNS,
    now: at,
    rand: Math.random,
  });
}

/**
 * One sitting: twenty le/la questions, then the paper.
 *
 * The screen is a view of the sitting, not the rule that keeps it: which
 * question is open, what an answer did, and what the paper counts all come
 * from `domain/sitting.ts`. Answers reach the ledger as they happen — a wrong
 * word joins it, a right review answer moves a box — so leaving mid-sitting
 * keeps what was already answered and nothing else. The summary is paper, not
 * a record: no score is kept anywhere, and "Encore" simply draws another
 * sitting.
 */
export function GenreDrillScreen({ route, navigation, now = Date.now }: Props) {
  const { review, ready } = useGenreState();
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const mode = route.params.mode;
  /**
   * What the boxes owe when the paper appears, counted off the clock once per
   * ledger — the same rule the lobby keeps, for the same reason: a render is a
   * function of its inputs, and each answer that lands hands in a new ledger,
   * so the last one is read at the moment the last answer was written.
   */
  const due = useMemo(() => reviewCount(review, now()), [review, now]);

  // Built once, after the ledger is readable: a review queue cannot be drawn
  // from a box that has not loaded, and rebuilding it on every answer would
  // renumber the sitting under the question being asked.
  useEffect(() => {
    if (ready && sitting === null) {
      setSitting(draw(mode, review, now()));
    }
  }, [mode, ready, review, sitting, now]);

  if (!ready || sitting === null) {
    return <Screen />;
  }

  const goBack = () => navigation.goBack();

  const bar = (right: React.ReactNode) => (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" onPress={goBack} hitSlop={10}>
        <Text style={styles.back}>{copy.backTo(copy.backFallback)}</Text>
      </Pressable>
      {right}
    </View>
  );

  const title = (text: string) =>
    bar(<Text style={styles.barTitle}>{text}</Text>);

  const start = (nextMode: Mode) => setSitting(draw(nextMode, review, now()));

  if (sitting.questions.length === 0) {
    // Reachable by a stale link or a hand-assembled route; the lobby already
    // keeps the button shut when the box is empty.
    return (
      <Screen>
        {title(
          sitting.mode === 'practice' ? copy.genreSessionTitle : copy.genreKind,
        )}
        <View style={styles.summary}>
          <Text style={styles.note}>{copy.genreEmpty}</Text>
        </View>
      </Screen>
    );
  }

  if (sitting.finished) {
    const paper = paperOf(sitting);
    return (
      <Screen>
        {title(
          sitting.mode === 'practice' ? copy.genreSessionTitle : copy.genreKind,
        )}
        {paper.kind === 'practice' ? (
          <PracticeSummary
            paper={paper}
            due={due}
            onAgain={() => start('practice')}
            onReview={() => start('review')}
          />
        ) : (
          <ReviewSummary
            paper={paper}
            due={due}
            onAgain={() => start('review')}
          />
        )}
      </Screen>
    );
  }

  const question = currentQuestion(sitting);
  if (question === null) {
    // The empty queue and the finished paper were both answered above; this is
    // only here so the card is never asked to draw nothing.
    return <Screen />;
  }

  const last = sitting.index + 1 >= sitting.questions.length;

  const answer = (gender: Gender) => {
    const step = answerSitting(sitting, gender, review, now());
    // A refused answer hands the same ledger back — the question is already
    // locked, so there is nothing new to write down.
    if (step.ledger !== review) {
      genreStore.apply(step.ledger);
    }
    setSitting(step.sitting);
  };

  const next = () => setSitting(nextQuestion(sitting));

  return (
    <Screen
      footer={
        sitting.picked === null ? undefined : (
          <View style={styles.footerRow}>
            <OutlinedButton
              label={last ? copy.genreFinish : copy.genreNext}
              onPress={next}
            />
          </View>
        )
      }
    >
      {bar(
        <Text style={styles.counter}>
          {pad(sitting.index + 1)} / {pad(sitting.questions.length)}
        </Text>,
      )}
      <GenreCard
        word={question.w}
        gloss={question.zh}
        gender={question.g}
        picked={sitting.picked}
        outcome={sitting.outcome}
        reviewBox={question.box}
        onPick={answer}
      />
    </Screen>
  );
}

/** The practice paper: how many were right, and which words were not. */
function PracticeSummary({
  paper,
  due,
  onAgain,
  onReview,
}: {
  paper: Extract<Paper, { kind: 'practice' }>;
  due: number;
  onAgain: () => void;
  onReview: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.summary}>
      <Text style={styles.score}>
        {copy.genreScore(paper.right, paper.answered)}
      </Text>
      {paper.flawless ? <VerdictStamp tier="flawless" /> : null}
      {paper.misses.length === 0 ? null : (
        <View style={styles.misses}>
          {paper.misses.map(miss => (
            <View key={miss.w} style={styles.missRow}>
              <Text style={styles.missWord}>{miss.w}</Text>
              <Text style={styles.missArticle}>{articleFor(miss.g)}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.again}>
        <OutlinedButton label={copy.genreAgain} onPress={onAgain} />
        <OutlinedButton
          label={due > 0 ? copy.genreReview(due) : copy.genreReviewEmpty}
          disabled={due === 0}
          onPress={onReview}
        />
      </View>
    </ScrollView>
  );
}

/** The review paper: how many words came back, and what the boxes did. */
function ReviewSummary({
  paper,
  due,
  onAgain,
}: {
  paper: Extract<Paper, { kind: 'review' }>;
  due: number;
  onAgain: () => void;
}) {
  const parts = [copy.genreAdvanced(paper.advanced)];
  if (paper.graduated > 0) {
    parts.push(copy.genreGraduatedCount(paper.graduated));
  }
  if (paper.sentBack > 0) {
    parts.push(copy.genreSentBack(paper.sentBack));
  }

  return (
    <ScrollView contentContainerStyle={styles.summary}>
      <Text style={styles.score}>{paper.reviewed}</Text>
      <Text style={styles.note}>
        {copy.genreReviewed(paper.reviewed)} · {parts.join(' · ')}
      </Text>
      <View style={styles.again}>
        <OutlinedButton
          label={due > 0 ? copy.genreReviewAgain(due) : copy.genreReviewNothing}
          disabled={due === 0}
          onPress={onAgain}
        />
      </View>
    </ScrollView>
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
  counter: {
    ...mono(11),
  },
  footerRow: {
    alignItems: 'flex-end',
  },
  summary: {
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
    paddingBottom: 24,
  },
  score: {
    ...mono(40, { color: colors.ink }),
    letterSpacing: 0.8,
  },
  note: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  misses: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  missRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  missWord: {
    ...mono(14, { color: colors.ink }),
  },
  missArticle: {
    ...mono(14, { color: colors.verdictWrong }),
  },
  again: {
    alignSelf: 'stretch',
    gap: 12,
  },
});

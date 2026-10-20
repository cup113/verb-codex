import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { GenreCard } from '../components/GenreCard';
import { OutlinedButton } from '../components/OutlinedButton';
import { VerdictStamp } from '../components/VerdictStamp';
import { copy } from '../copy';
import { colors, fonts, mono, serif } from '../theme';
import { genreStore, useGenreState } from '../storage/genreStore';
import {
  SESSION_SIZE,
  articleFor,
  drawSession,
  dueItems,
  indexBank,
  reviewCount,
} from '../domain/genre';
import type { AnswerOutcome, Box, Gender, ReviewState } from '../domain/genre';
import { NOUNS } from '../data/nouns';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'GenreDrill'>;

/** The bank by word, once: a review card carries no gloss of its own. */
const BANK = indexBank(NOUNS);

type Mode = 'practice' | 'review';

type Question = {
  w: string;
  g: Gender;
  /** The bank's gloss; empty when the ledger holds a word the bank dropped. */
  zh: string;
  /** The box the question came from — null in a practice sitting. */
  box: Box | null;
};

type PracticeAnswer = { w: string; g: Gender; correct: boolean };
type ReviewResult = { w: string; outcome: AnswerOutcome | null };

type Session = {
  mode: Mode;
  queue: readonly Question[];
  index: number;
  picked: Gender | null;
  outcome: AnswerOutcome | null;
  answers: readonly PracticeAnswer[];
  results: readonly ReviewResult[];
  finished: boolean;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A sitting is a snapshot: the queue is drawn once, so answering a question
 * cannot change what the counter says the sitting contains.
 */
function buildSession(mode: Mode, review: ReviewState, now: number): Session {
  const queue: Question[] =
    mode === 'practice'
      ? drawSession(NOUNS, SESSION_SIZE, Math.random).map(noun => ({
          w: noun.w,
          g: noun.g,
          zh: noun.zh,
          box: null,
        }))
      : dueItems(review, now)
          .slice(0, SESSION_SIZE)
          .map(item => ({
            w: item.w,
            g: item.g,
            zh: BANK.get(item.w)?.zh ?? '',
            box: item.box,
          }));
  return {
    mode,
    queue,
    index: 0,
    picked: null,
    outcome: null,
    answers: [],
    results: [],
    finished: false,
  };
}

/**
 * One sitting: twenty le/la questions, then the paper.
 *
 * Answers are written to the ledger as they happen — a wrong word joins it, a
 * right review answer moves a box — so leaving mid-sitting keeps what was
 * already answered and nothing else. The summary is paper, not a record: no
 * score is kept anywhere, and "Encore" simply draws another sitting.
 */
export function GenreDrillScreen({ route, navigation }: Props) {
  const { review, ready } = useGenreState();
  const [session, setSession] = useState<Session | null>(null);
  const mode = route.params.mode;

  // Built once, after the ledger is readable: a review queue cannot be drawn
  // from a box that has not loaded, and rebuilding it on every answer would
  // renumber the sitting under the question being asked.
  useEffect(() => {
    if (ready && session === null) {
      setSession(buildSession(mode, review, Date.now()));
    }
  }, [mode, ready, review, session]);

  if (!ready || session === null) {
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

  const title = (text: string) => bar(<Text style={styles.barTitle}>{text}</Text>);

  const start = (nextMode: Mode) =>
    setSession(buildSession(nextMode, review, Date.now()));

  if (session.queue.length === 0) {
    // Reachable by a stale link or a hand-assembled route; the lobby already
    // keeps the button shut when the box is empty.
    return (
      <Screen>
        {title(session.mode === 'practice' ? copy.genreSessionTitle : copy.genreKind)}
        <View style={styles.summary}>
          <Text style={styles.note}>{copy.genreEmpty}</Text>
        </View>
      </Screen>
    );
  }

  if (session.finished) {
    const due = reviewCount(review, Date.now());
    return (
      <Screen>
        {title(
          session.mode === 'practice'
            ? copy.genreSessionTitle
            : copy.genreKind,
        )}
        {session.mode === 'practice' ? (
          <PracticeSummary
            session={session}
            due={due}
            onAgain={() => start('practice')}
            onReview={() => start('review')}
          />
        ) : (
          <ReviewSummary
            session={session}
            due={due}
            onAgain={() => start('review')}
          />
        )}
      </Screen>
    );
  }

  const question = session.queue[session.index];
  const last = session.index + 1 >= session.queue.length;

  const answer = (gender: Gender) => {
    if (session.picked !== null) {
      return;
    }
    const correct = question.g === gender;
    if (session.mode === 'practice') {
      if (!correct) {
        genreStore.recordWrong(question);
      }
      setSession({
        ...session,
        picked: gender,
        // A right practice answer has nothing to add: it changed no box.
        outcome: correct ? null : { kind: 'toReview' },
        answers: [
          ...session.answers,
          { w: question.w, g: question.g, correct },
        ],
      });
      return;
    }
    if (correct) {
      const written = genreStore.recordRight(question);
      const outcome: AnswerOutcome | null =
        written.kind === 'advanced'
          ? { kind: 'advanced', box: written.box }
          : written.kind === 'graduated'
            ? { kind: 'graduated' }
            : null;
      setSession({
        ...session,
        picked: gender,
        outcome,
        results: [...session.results, { w: question.w, outcome }],
      });
      return;
    }
    genreStore.recordWrong(question);
    const outcome: AnswerOutcome = { kind: 'sentBack' };
    setSession({
      ...session,
      picked: gender,
      outcome,
      results: [...session.results, { w: question.w, outcome }],
    });
  };

  const next = () => {
    if (session.picked === null) {
      return;
    }
    setSession({
      ...session,
      index: last ? session.index : session.index + 1,
      picked: null,
      outcome: null,
      finished: last,
    });
  };

  return (
    <Screen
      footer={
        session.picked === null ? undefined : (
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
          {pad(session.index + 1)} / {pad(session.queue.length)}
        </Text>,
      )}
      <GenreCard
        word={question.w}
        gloss={question.zh}
        gender={question.g}
        picked={session.picked}
        outcome={session.outcome}
        reviewBox={question.box}
        onPick={answer}
      />
    </Screen>
  );
}

/** The practice paper: how many were right, and which words were not. */
function PracticeSummary({
  session,
  due,
  onAgain,
  onReview,
}: {
  session: Session;
  due: number;
  onAgain: () => void;
  onReview: () => void;
}) {
  const right = session.answers.filter(answer => answer.correct).length;
  const misses = session.answers.filter(answer => !answer.correct);
  const flawless = session.answers.length > 0 && misses.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.summary}>
      <Text style={styles.score}>
        {copy.genreScore(right, session.answers.length)}
      </Text>
      {flawless ? <VerdictStamp tier="flawless" /> : null}
      {misses.length === 0 ? null : (
        <View style={styles.misses}>
          {misses.map(answer => (
            <View key={answer.w} style={styles.missRow}>
              <Text style={styles.missWord}>{answer.w}</Text>
              <Text style={styles.missArticle}>{articleFor(answer.g)}</Text>
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
  session,
  due,
  onAgain,
}: {
  session: Session;
  due: number;
  onAgain: () => void;
}) {
  const advanced = session.results.filter(
    result => result.outcome?.kind === 'advanced',
  ).length;
  const graduated = session.results.filter(
    result => result.outcome?.kind === 'graduated',
  ).length;
  const sentBack = session.results.filter(
    result => result.outcome?.kind === 'sentBack',
  ).length;
  const parts = [copy.genreAdvanced(advanced)];
  if (graduated > 0) {
    parts.push(copy.genreGraduatedCount(graduated));
  }
  if (sentBack > 0) {
    parts.push(copy.genreSentBack(sentBack));
  }

  return (
    <ScrollView contentContainerStyle={styles.summary}>
      <Text style={styles.score}>{session.results.length}</Text>
      <Text style={styles.note}>
        {copy.genreReviewed(session.results.length)} · {parts.join(' · ')}
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

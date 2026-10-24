/**
 * One sitting of the gender drill: twenty le/la questions asked in order, and
 * the paper that is drawn from them.
 *
 * The boxes' arithmetic lives in `genre.ts`; this module says what a sitting
 * *is* — the queue it was drawn as, which question is open, what each answer
 * did to the ledger, and what the paper counts. Nothing here is ambient: the
 * ledger, the bank, the clock and the random stream are all parameters, which
 * is what lets a test ask for a fixed sitting instead of pressing through
 * twenty cards to find out which words came up.
 *
 * The one rule that keeps the screen from writing twice: an answer that was
 * refused (the question is locked, or the sitting is over) hands back the very
 * same `Sitting` and the very same ledger, so a caller comparing by identity
 * writes nothing.
 */

import {
  SESSION_SIZE,
  drawSession,
  dueItems,
  indexBank,
  recordRight,
  recordWrong,
} from './genre';
import type {
  AnswerOutcome,
  Box,
  Gender,
  Noun,
  ReviewState,
  RightOutcome,
} from './genre';

/** Which way the sitting was entered from the lobby. */
export type Mode = 'practice' | 'review';

export type Question = {
  /** The word as the bank spells it — `cœur`, not `coeur`. */
  w: string;
  g: Gender;
  /**
   * The bank's one-line Chinese note, looked up when the question is drawn.
   * Empty when the bank has since dropped the word: the question is still
   * asked, and the line is simply not there.
   */
  zh: string;
  /** The box a review question came out of; `null` in a practice sitting. */
  box: Box | null;
};

/**
 * One answered question, in the card's own vocabulary: a `null` outcome means
 * it changed no box, which is every right answer in a practice sitting.
 */
export type Attempt = {
  w: string;
  g: Gender;
  outcome: AnswerOutcome | null;
};

/**
 * A sitting as one value: the queue drawn when it began, the question that is
 * open, and every answer given so far. The queue is a snapshot — answering
 * cannot change what the counter says the sitting contains.
 */
export type Sitting = {
  mode: Mode;
  questions: readonly Question[];
  index: number;
  /** The article touched on the open question, or `null` while it is open. */
  picked: Gender | null;
  /** What that answer did to the ledger; `null` when it did nothing. */
  outcome: AnswerOutcome | null;
  attempts: readonly Attempt[];
  finished: boolean;
};

/**
 * The paper a finished sitting earns, as counts rather than sentences: what it
 * says is `copy`'s business, and a review is papered by boxes moved rather
 * than by a score (ADR 0003).
 */
export type Paper =
  | {
      kind: 'practice';
      /** How many questions were answered — the counter's own denominator. */
      answered: number;
      right: number;
      /** Every question answered, and every one of them right. */
      flawless: boolean;
      misses: readonly { w: string; g: Gender }[];
    }
  | {
      kind: 'review';
      reviewed: number;
      advanced: number;
      graduated: number;
      sentBack: number;
    };

/**
 * Draw a sitting from the bank or from the boxes.
 *
 * A practice sitting is drawn by frequency-weighted lot without replacement; a
 * review sitting is whatever the ledger owes, most overdue first, capped at a
 * sitting so a long absence does not turn into one endless card after another.
 */
export function startSitting(args: {
  mode: Mode;
  ledger: ReviewState;
  bank: readonly Noun[];
  now: number;
  rand: () => number;
}): Sitting {
  const questions =
    args.mode === 'practice'
      ? drawSession(args.bank, SESSION_SIZE, args.rand).map(noun => ({
          w: noun.w,
          g: noun.g,
          zh: noun.zh,
          box: null,
        }))
      : owedQuestions(args.ledger, args.bank, args.now);
  return {
    mode: args.mode,
    questions,
    index: 0,
    picked: null,
    outcome: null,
    attempts: [],
    finished: false,
  };
}

/**
 * The questions the ledger owes, with their notes fetched back from the bank.
 *
 * The ledger records what is due, not what the words mean: a box carries the
 * word, its gender and its number, so the one-line Chinese note is looked up
 * by word here. A word the bank no longer carries still comes up, with an
 * empty line — the boxes are the owner's, and they do not shrink because the
 * bank was revised.
 */
function owedQuestions(
  ledger: ReviewState,
  bank: readonly Noun[],
  now: number,
): Question[] {
  const glosses = indexBank(bank);
  return dueItems(ledger, now)
    .slice(0, SESSION_SIZE)
    .map(item => ({
      w: item.w,
      g: item.g,
      zh: glosses.get(item.w)?.zh ?? '',
      box: item.box,
    }));
}

/** The question on the card, or `null` when the paper is out or nothing was drawn. */
export function currentQuestion(sitting: Sitting): Question | null {
  if (sitting.finished) {
    return null;
  }
  return sitting.questions[sitting.index] ?? null;
}

/**
 * Grade one touch of an article, and work out what it did to the boxes.
 *
 * A practice answer only ever writes on a mistake — a right one changed no
 * box, so it hands the ledger straight back. A review answer walks the boxes
 * through the ledger's own arithmetic, so what the card reports and what is
 * written down cannot come apart.
 */
export function answerSitting(
  sitting: Sitting,
  gender: Gender,
  ledger: ReviewState,
  now: number,
): { sitting: Sitting; ledger: ReviewState } {
  const question = currentQuestion(sitting);
  // One answer per question: a second touch on a locked card changes nothing,
  // and hands the very same ledger back so the caller writes nothing.
  if (question === null || sitting.picked !== null) {
    return { sitting, ledger };
  }
  if (sitting.mode === 'practice') {
    if (question.g === gender) {
      return { sitting: answered(sitting, question, gender, null), ledger };
    }
    return {
      sitting: answered(sitting, question, gender, { kind: 'toReview' }),
      ledger: recordWrong(ledger, question, now),
    };
  }
  if (question.g !== gender) {
    return {
      sitting: answered(sitting, question, gender, { kind: 'sentBack' }),
      ledger: recordWrong(ledger, question, now),
    };
  }
  const written = recordRight(ledger, question, now);
  return {
    sitting: answered(sitting, question, gender, boxMoved(written.outcome)),
    ledger: written.state,
  };
}

/** What the card may say about a right answer: a box moved, or the word graduated. */
function boxMoved(outcome: RightOutcome): AnswerOutcome | null {
  switch (outcome.kind) {
    case 'advanced':
      return { kind: 'advanced', box: outcome.box };
    case 'graduated':
      return { kind: 'graduated' };
    default:
      // The ledger was not holding the word at all: nothing to report, and the
      // state came back untouched.
      return null;
  }
}

function answered(
  sitting: Sitting,
  question: Question,
  gender: Gender,
  outcome: AnswerOutcome | null,
): Sitting {
  return {
    ...sitting,
    picked: gender,
    outcome,
    attempts: [...sitting.attempts, { w: question.w, g: question.g, outcome }],
  };
}

/**
 * Move on to the next question, or turn the paper over after the last one.
 *
 * Nothing happens until the open question has been answered: the counter and
 * the card are one thing, and an unanswered question cannot be stepped past.
 */
export function nextQuestion(sitting: Sitting): Sitting {
  if (sitting.picked === null || sitting.finished) {
    return sitting;
  }
  const last = sitting.index + 1 >= sitting.questions.length;
  return {
    ...sitting,
    index: last ? sitting.index : sitting.index + 1,
    picked: null,
    outcome: null,
    finished: last,
  };
}

/**
 * The paper, read off the answers.
 *
 * A practice paper counts right answers out of those given and lists the words
 * that went into the boxes; it is flawless only if every question was answered
 * and every one of them right — a paper cannot be perfect for having answered
 * half of it. A review paper counts what the boxes did, in four numbers.
 */
export function paperOf(sitting: Sitting): Paper {
  if (sitting.mode === 'practice') {
    const misses = sitting.attempts
      .filter(attempt => attempt.outcome?.kind === 'toReview')
      .map(attempt => ({ w: attempt.w, g: attempt.g }));
    return {
      kind: 'practice',
      answered: sitting.attempts.length,
      right: sitting.attempts.filter(attempt => attempt.outcome === null)
        .length,
      flawless:
        misses.length === 0 &&
        sitting.attempts.length > 0 &&
        sitting.attempts.length === sitting.questions.length,
      misses,
    };
  }
  const count = (kind: AnswerOutcome['kind']) =>
    sitting.attempts.filter(attempt => attempt.outcome?.kind === kind).length;
  return {
    kind: 'review',
    reviewed: sitting.attempts.length,
    advanced: count('advanced'),
    graduated: count('graduated'),
    sentBack: count('sentBack'),
  };
}

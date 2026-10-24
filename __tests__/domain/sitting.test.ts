import {
  answerSitting,
  currentQuestion,
  nextQuestion,
  paperOf,
  startSitting,
} from '../../src/domain/sitting';
import type { Sitting } from '../../src/domain/sitting';
import { SESSION_SIZE, emptyReview } from '../../src/domain/genre';
import type {
  Gender,
  Noun,
  ReviewItem,
  ReviewState,
} from '../../src/domain/genre';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function noun(w: string, g: Gender, f = 100): Noun {
  return { w, g, f, zh: `${w} 的短注` };
}

function bank(size: number): Noun[] {
  return Array.from({ length: size }, (_item, index) =>
    noun(`mot${index}`, index % 2 === 0 ? 'm' : 'f', 1000 - index),
  );
}

/** A ledger holding one word in the box and due instant given. */
function withItem(item: Partial<ReviewItem> & { w: string }): ReviewState {
  const full: ReviewItem = { g: 'f', box: 1, due: NOW, ...item };
  return { items: { [full.w]: full } };
}

/** One fixed value: the draw is then a fixed sitting, word for word. */
const halfway = () => 0.5;

/** The other article: answering with it is always wrong. */
function wrongOf(g: Gender): Gender {
  return g === 'm' ? 'f' : 'm';
}

function practice(ledger: ReviewState = emptyReview()): Sitting {
  return startSitting({
    mode: 'practice',
    ledger,
    bank: bank(1000),
    now: NOW,
    rand: halfway,
  });
}

function review(ledger: ReviewState, size = 3): Sitting {
  return startSitting({
    mode: 'review',
    ledger,
    bank: bank(size),
    now: NOW,
    rand: halfway,
  });
}

/**
 * Answer a sitting in order, threading the ledger the answers change.
 *
 * `Date.now` is not consulted anywhere here: a sitting takes its clock as a
 * parameter, which is the whole reason these rules can be read off a value
 * instead of pressed through twenty cards.
 */
function play(sitting: Sitting, picks: readonly Gender[], ledger: ReviewState) {
  let current = sitting;
  let held = ledger;
  picks.forEach(gender => {
    const step = answerSitting(current, gender, held, NOW);
    current = nextQuestion(step.sitting);
    held = step.ledger;
  });
  return { sitting: current, ledger: held };
}

describe('a sitting is drawn', () => {
  it('draws a whole sitting from the bank, without repeating a word', () => {
    const sitting = practice();

    expect(sitting.questions).toHaveLength(SESSION_SIZE);
    expect(new Set(sitting.questions.map(question => question.w)).size).toBe(
      SESSION_SIZE,
    );
    // A practice question carries the bank's own note, and came out of no box.
    expect(sitting.questions.every(question => question.zh !== '')).toBe(true);
    expect(sitting.questions.every(question => question.box === null)).toBe(
      true,
    );
    expect(currentQuestion(sitting)).toBe(sitting.questions[0]);
    expect(sitting.picked).toBeNull();
    expect(sitting.finished).toBe(false);
  });

  it('asks only what the boxes owe, most overdue first, and no more than a sitting', () => {
    const ledger: ReviewState = {
      items: {
        tard: { w: 'tard', g: 'm', box: 2, due: NOW + DAY },
        tot: { w: 'tot', g: 'm', box: 2, due: NOW - 2 * DAY },
        maintenant: { w: 'maintenant', g: 'm', box: 1, due: NOW },
      },
    };

    const sitting = review(ledger);

    expect(sitting.questions.map(question => question.w)).toEqual([
      'tot',
      'maintenant',
    ]);
    // The box a question came out of travels with it, for the card's tag.
    expect(sitting.questions.map(question => question.box)).toEqual([2, 1]);

    const many: ReviewState = {
      items: Object.fromEntries(
        Array.from({ length: 25 }, (_item, index) => [
          `mot${index}`,
          {
            w: `mot${index}`,
            g: 'm' as const,
            box: 1 as const,
            due: NOW - index,
          },
        ]),
      ),
    };
    expect(review(many, 30).questions).toHaveLength(SESSION_SIZE);
  });

  it('fetches the note back from the bank, and asks a word it has dropped without one', () => {
    const known = review(withItem({ w: 'mot0', g: 'm', box: 1, due: NOW }));
    expect(currentQuestion(known)?.zh).toBe('mot0 的短注');

    // The boxes are the owner's: a word the bank no longer carries still comes
    // up, its one-line note simply left blank.
    const dropped = review(
      withItem({ w: 'mot-inconnu', g: 'm', box: 1, due: NOW }),
    );
    expect(currentQuestion(dropped)).toMatchObject({
      w: 'mot-inconnu',
      zh: '',
    });
  });

  it('keeps the queue it was drawn as, whatever is answered', () => {
    const sitting = practice();
    const question = currentQuestion(sitting);

    const after = answerSitting(
      sitting,
      question!.g,
      emptyReview(),
      NOW,
    ).sitting;

    expect(after.questions).toBe(sitting.questions);
    expect(after.attempts).toHaveLength(1);
    expect(currentQuestion(after)).toBe(question);
  });
});

describe('a sitting is answered one question at a time', () => {
  it('locks the question once it has been answered', () => {
    const ledger = emptyReview();
    const sitting = practice();
    const question = currentQuestion(sitting);
    const first = answerSitting(sitting, question!.g, ledger, NOW);

    const second = answerSitting(first.sitting, 'm', first.ledger, NOW);

    // The very same value and the very same ledger: a caller comparing by
    // identity writes nothing, and nothing is judged twice.
    expect(second.sitting).toBe(first.sitting);
    expect(second.ledger).toBe(first.ledger);
    expect(second.sitting.attempts).toHaveLength(1);
  });

  it('will not step past a question that was never answered', () => {
    const sitting = practice();

    expect(nextQuestion(sitting)).toBe(sitting);
  });

  it('walks the counter forward, and turns the paper over after the last one', () => {
    const ledger = withItem({ w: 'vie', g: 'f', box: 1, due: NOW });
    const one = review(ledger);
    const answered = answerSitting(one, 'f', ledger, NOW).sitting;

    const done = nextQuestion(answered);

    expect(done.finished).toBe(true);
    expect(currentQuestion(done)).toBeNull();
    // A finished paper is not stepped past either.
    expect(nextQuestion(done)).toBe(done);
  });

  it('moves one question on, resetting what the card was showing', () => {
    const sitting = practice();
    const question = currentQuestion(sitting);
    const answered = answerSitting(
      sitting,
      question!.g,
      emptyReview(),
      NOW,
    ).sitting;

    const next = nextQuestion(answered);

    expect(next.index).toBe(1);
    expect(next.picked).toBeNull();
    expect(next.outcome).toBeNull();
    expect(next.finished).toBe(false);
    expect(currentQuestion(next)).toBe(sitting.questions[1]);
  });
});

describe('an answer reaches the boxes through the sitting', () => {
  it('leaves the ledger alone when a practice answer is right', () => {
    const ledger = emptyReview();
    const sitting = practice();
    const question = currentQuestion(sitting);

    const step = answerSitting(sitting, question!.g, ledger, NOW);

    expect(step.sitting.outcome).toBeNull();
    // Byte-identical: a right practice answer changed no box.
    expect(step.ledger).toBe(ledger);
  });

  it('puts a wrong practice answer in box 1 and says it went to review', () => {
    const sitting = practice();
    const question = currentQuestion(sitting);
    const wrong: Gender = question!.g === 'm' ? 'f' : 'm';

    const step = answerSitting(sitting, wrong, emptyReview(), NOW);

    expect(step.sitting.outcome).toEqual({ kind: 'toReview' });
    expect(step.ledger.items[question!.w]).toEqual({
      w: question!.w,
      g: question!.g,
      box: 1,
      due: NOW,
    });
  });

  it('moves a right review answer up one box, and reports which', () => {
    const ledger = withItem({ w: 'vie', g: 'f', box: 1, due: NOW });
    const sitting = review(ledger);

    const step = answerSitting(sitting, 'f', ledger, NOW);

    expect(step.sitting.outcome).toEqual({ kind: 'advanced', box: 2 });
    expect(step.ledger.items.vie).toEqual({
      w: 'vie',
      g: 'f',
      box: 2,
      due: NOW + DAY,
    });
  });

  it('graduates a word answered right in the fourth box', () => {
    const ledger = withItem({ w: 'vie', g: 'f', box: 4, due: NOW });
    const sitting = review(ledger);

    const step = answerSitting(sitting, 'f', ledger, NOW);

    expect(step.sitting.outcome).toEqual({ kind: 'graduated' });
    expect(step.ledger.items.vie).toBeUndefined();
  });

  it('sends a wrong review answer back to box 1 from any box', () => {
    const ledger = withItem({ w: 'vie', g: 'f', box: 3, due: NOW });
    const sitting = review(ledger);

    const step = answerSitting(sitting, 'm', ledger, NOW);

    expect(step.sitting.outcome).toEqual({ kind: 'sentBack' });
    expect(step.ledger.items.vie).toEqual({
      w: 'vie',
      g: 'f',
      box: 1,
      due: NOW,
    });
  });

  it('says nothing when the ledger is not holding the word at all', () => {
    const ledger = withItem({ w: 'vie', g: 'f', box: 1, due: NOW });
    const sitting = review(ledger);
    // The word left the ledger between the draw and the answer: the boxes stay
    // as they are, and the card has nothing to report.
    const emptied = emptyReview();

    const step = answerSitting(sitting, 'f', emptied, NOW);

    expect(step.sitting.outcome).toBeNull();
    expect(step.ledger).toBe(emptied);
  });
});

describe('the paper', () => {
  it('counts a practice paper out of the answers given, and lists the misses in order', () => {
    const sitting = practice();
    const [first, second, third] = sitting.questions;

    const { sitting: finished } = play(
      sitting,
      [first.g, wrongOf(second.g), third.g],
      emptyReview(),
    );
    const paper = paperOf(finished);

    expect(paper).toEqual({
      kind: 'practice',
      answered: 3,
      right: 2,
      flawless: false,
      misses: [{ w: second.w, g: second.g }],
    });
  });

  it('stamps a practice paper only when every question was answered and every one was right', () => {
    const sitting = practice();
    const allRight = play(
      sitting,
      sitting.questions.map(question => question.g),
      emptyReview(),
    );

    expect(paperOf(allRight.sitting)).toEqual({
      kind: 'practice',
      answered: SESSION_SIZE,
      right: SESSION_SIZE,
      flawless: true,
      misses: [],
    });
    // Half a paper, however clean, is not a flawless one.
    expect(
      paperOf(play(sitting, [sitting.questions[0].g], emptyReview()).sitting),
    ).toMatchObject({
      answered: 1,
      right: 1,
      flawless: false,
    });
    // Nor is a whole paper with one word wrong on it.
    expect(
      paperOf(
        play(
          sitting,
          sitting.questions.map((question, index) =>
            index === 0 ? wrongOf(question.g) : question.g,
          ),
          emptyReview(),
        ).sitting,
      ),
    ).toMatchObject({
      answered: SESSION_SIZE,
      right: SESSION_SIZE - 1,
      flawless: false,
    });
    expect(paperOf(sitting)).toMatchObject({
      answered: 0,
      right: 0,
      flawless: false,
    });
  });

  it('sums a review paper up as boxes moved, not as a score', () => {
    const ledger: ReviewState = {
      items: {
        vie: { w: 'vie', g: 'f', box: 1, due: NOW - 3 * DAY },
        temps: { w: 'temps', g: 'm', box: 4, due: NOW - 2 * DAY },
        nuit: { w: 'nuit', g: 'f', box: 2, due: NOW - DAY },
      },
    };
    const sitting = review(ledger);

    const { sitting: finished, ledger: after } = play(
      sitting,
      ['f', 'm', 'm'],
      ledger,
    );
    const paper = paperOf(finished);

    expect(paper).toEqual({
      kind: 'review',
      reviewed: 3,
      advanced: 1,
      graduated: 1,
      sentBack: 1,
    });
    expect(after.items).toEqual({
      vie: { w: 'vie', g: 'f', box: 2, due: NOW + DAY },
      nuit: { w: 'nuit', g: 'f', box: 1, due: NOW },
    });
  });
});

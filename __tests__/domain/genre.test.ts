import {
  BOX_DAYS,
  articleFor,
  boxCount,
  drawSession,
  dueItems,
  emptyReview,
  indexBank,
  nextDue,
  parseReview,
  recordRight,
  recordWrong,
  reviewCount,
  serializeReview,
} from '../../src/domain/genre';
import type { Noun, ReviewItem, ReviewState } from '../../src/domain/genre';
import { SESSION_SIZE } from '../../src/domain/sitting';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function noun(w: string, g: 'm' | 'f', f = 100): Noun {
  return { w, g, f, zh: `${w} 的短注` };
}

/** A ledger holding one word in the box and due instant given. */
function withItem(item: Partial<ReviewItem> & { w: string }): ReviewState {
  const full: ReviewItem = {
    g: 'f',
    box: 1,
    due: NOW,
    ...item,
  };
  return { items: { [full.w]: full } };
}

describe('the boxes keep the intervals ADR 0003 settled', () => {
  it('uses 0 / 1 / 3 / 7 days for boxes 1 to 4', () => {
    expect(BOX_DAYS).toEqual({ 1: 0, 2: 1, 3: 3, 4: 7 });
    expect(nextDue(1, NOW)).toBe(NOW);
    expect(nextDue(2, NOW)).toBe(NOW + DAY);
    expect(nextDue(3, NOW)).toBe(NOW + 3 * DAY);
    expect(nextDue(4, NOW)).toBe(NOW + 7 * DAY);
  });

  it('puts a wrong word in box 1, due at once', () => {
    const state = recordWrong(emptyReview(), noun('vie', 'f'), NOW);

    expect(state.items.vie).toEqual({ w: 'vie', g: 'f', box: 1, due: NOW });
    expect(reviewCount(state, NOW)).toBe(1);
  });

  it('sends a word back to box 1 from any box it had reached', () => {
    const state = recordWrong(withItem({ w: 'vie', box: 3, due: NOW + 3 * DAY }), noun('vie', 'f'), NOW);

    expect(state.items.vie.box).toBe(1);
    expect(state.items.vie.due).toBe(NOW);
  });

  it('walks a right answer up one box at a time', () => {
    let state = recordWrong(emptyReview(), noun('vie', 'f'), NOW);

    const second = recordRight(state, noun('vie', 'f'), NOW);
    expect(second.outcome).toEqual({ kind: 'advanced', box: 2 });
    expect(second.state.items.vie).toEqual({
      w: 'vie',
      g: 'f',
      box: 2,
      due: NOW + DAY,
    });

    const third = recordRight(second.state, noun('vie', 'f'), NOW + DAY);
    expect(third.state.items.vie.box).toBe(3);
    expect(third.state.items.vie.due).toBe(NOW + DAY + 3 * DAY);

    const fourth = recordRight(third.state, noun('vie', 'f'), NOW + DAY + 3 * DAY);
    expect(fourth.state.items.vie.box).toBe(4);
  });

  it('graduates a word answered right in the fourth box', () => {
    const state = withItem({ w: 'vie', box: 4, due: NOW });

    const written = recordRight(state, noun('vie', 'f'), NOW);

    expect(written.outcome).toEqual({ kind: 'graduated' });
    expect(written.state.items.vie).toBeUndefined();
    expect(boxCount(written.state)).toBe(0);
  });

  it('says nothing for a word the ledger is not holding', () => {
    const state = emptyReview();
    const written = recordRight(state, noun('vie', 'f'), NOW);

    expect(written.outcome).toEqual({ kind: 'none' });
    expect(written.state).toBe(state);
  });
});

describe('what is due', () => {
  it('brings back only what is due, most overdue first', () => {
    const state: ReviewState = {
      items: {
        tard: { w: 'tard', g: 'm', box: 2, due: NOW + DAY },
        tot: { w: 'tot', g: 'm', box: 2, due: NOW - 2 * DAY },
        maintenant: { w: 'maintenant', g: 'm', box: 1, due: NOW },
      },
    };

    expect(dueItems(state, NOW).map(item => item.w)).toEqual([
      'tot',
      'maintenant',
    ]);
    expect(reviewCount(state, NOW)).toBe(2);
    expect(boxCount(state)).toBe(3);
  });

  it('has nothing to bring back from an empty ledger', () => {
    expect(dueItems(emptyReview(), NOW)).toEqual([]);
    expect(boxCount(emptyReview())).toBe(0);
  });
});

describe('the ledger survives a bad disk', () => {
  it('round-trips through its own text', () => {
    const state = withItem({ w: 'vie', box: 3, due: NOW + DAY });

    expect(parseReview(serializeReview(state))).toEqual(state);
  });

  it('reads nothing at all from a missing key, a broken value or a foreign shape', () => {
    expect(parseReview(null)).toEqual(emptyReview());
    expect(parseReview('{')).toEqual(emptyReview());
    expect(parseReview('null')).toEqual(emptyReview());
    expect(parseReview('"vie"')).toEqual(emptyReview());
    expect(parseReview('{"items":[]}')).toEqual(emptyReview());
    expect(parseReview('{"v":1}')).toEqual(emptyReview());
  });

  it('drops the entries that cannot be a question and keeps the rest', () => {
    const raw = JSON.stringify({
      v: 1,
      items: {
        garde: { w: 'garde', g: 'f', box: 2, due: NOW },
        sansgenre: { w: 'sansgenre', g: 'x', box: 2, due: NOW },
        sansbox: { w: 'sansbox', g: 'm', box: 9, due: NOW },
        sansdue: { w: 'sansdue', g: 'm', box: 1, due: 'demain' },
        vide: { w: '', g: 'm', box: 1, due: NOW },
      },
    });

    const state = parseReview(raw);

    expect(Object.keys(state.items)).toEqual(['garde']);
  });

  it('still reads a ledger written by a newer format', () => {
    const raw = JSON.stringify({
      v: 99,
      items: { garde: { w: 'garde', g: 'm', box: 2, due: NOW } },
    });

    expect(parseReview(raw).items.garde.box).toBe(2);
  });
});

describe('a sitting is drawn from the bank', () => {
  function bank(size: number): Noun[] {
    return Array.from({ length: size }, (_item, index) =>
      noun(`mot${index}`, index % 2 === 0 ? 'm' : 'f', 1000 - index),
    );
  }

  it('draws exactly a sitting, without repeating a word', () => {
    const drawn = drawSession(bank(1000), SESSION_SIZE, Math.random);

    expect(drawn).toHaveLength(SESSION_SIZE);
    expect(new Set(drawn.map(item => item.w)).size).toBe(SESSION_SIZE);
  });

  it('draws the same sitting for the same random stream', () => {
    const sequence = (): (() => number) => {
      let index = 0;
      const values = [0.1, 0.9, 0.4, 0.7, 0.2];
      return () => values[index++ % values.length];
    };

    const first = drawSession(bank(1000), SESSION_SIZE, sequence());
    const second = drawSession(bank(1000), SESSION_SIZE, sequence());

    expect(first.map(item => item.w)).toEqual(second.map(item => item.w));
  });

  it('draws the whole bank when the bank is smaller than a sitting', () => {
    const drawn = drawSession(bank(5), SESSION_SIZE, Math.random);

    expect(drawn).toHaveLength(5);
    expect(drawn.map(item => item.w).sort()).toEqual([
      'mot0',
      'mot1',
      'mot2',
      'mot3',
      'mot4',
    ]);
  });

  it('still draws when the cursor lands on the very end of the range', () => {
    const drawn = drawSession(bank(3), 3, () => 1);

    expect(drawn).toHaveLength(3);
  });
});

describe('the one bit of French', () => {
  it('names the article a gender wears', () => {
    expect(articleFor('m')).toBe('le');
    expect(articleFor('f')).toBe('la');
  });

  it('indexes the bank by word', () => {
    const index = indexBank([noun('temps', 'm'), noun('vie', 'f')]);

    expect(index.get('vie')?.g).toBe('f');
    expect(index.get('absent')).toBeUndefined();
  });
});

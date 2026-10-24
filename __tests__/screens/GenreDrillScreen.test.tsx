import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { GenreCard } from '../../src/components/GenreCard';
import { VerdictStamp } from '../../src/components/VerdictStamp';
import { OutlinedButton } from '../../src/components/OutlinedButton';
import { GenreDrillScreen } from '../../src/screens/GenreDrillScreen';
import { copy } from '../../src/copy';
import { articleFor, emptyReview, recordWrong } from '../../src/domain/genre';
import type { ReviewState } from '../../src/domain/genre';
import { SESSION_SIZE } from '../../src/domain/sitting';
import { genreStore } from '../../src/storage/genreStore';
import { NOUNS } from '../../src/data/nouns';

type ScreenProps = React.ComponentProps<typeof GenreDrillScreen>;

// The first render of this file transforms a large module graph on a cold
// cache, which easily overruns Jest's five-second default.
jest.setTimeout(60_000);

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

/** A ledger holding `held`, each in box 1 and due at once — what a wrong answer leaves. */
function ledgerOf(held: readonly { w: string; g: 'm' | 'f' }[]): ReviewState {
  return held.reduce<ReviewState>(
    (ledger, noun) => recordWrong(ledger, noun, Date.now()),
    emptyReview(),
  );
}

/** Render a sitting, with `held` words already due in the ledger. */
async function renderDrill(
  mode: 'practice' | 'review',
  held: readonly { w: string; g: 'm' | 'f' }[] = [],
) {
  // The ledger is the app singleton: what a review asks is what was written.
  await ReactTestRenderer.act(async () => {
    await genreStore.init();
    genreStore.apply(ledgerOf(held));
  });
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  } as unknown as ScreenProps['navigation'];
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GenreDrillScreen
          navigation={navigation}
          route={
            {
              key: 'GenreDrill-1',
              name: 'GenreDrill',
              params: { mode },
            } as ScreenProps['route']
          }
        />
      </SafeAreaProvider>,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return { tree: rendered, navigation };
}

/** The text a node puts on paper, including any nested `Text` runs. */
function textOf(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join('');
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(node => textOf(node));
}

/** The footer buttons, in the order they sit in. */
function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(OutlinedButton).map(node => node.props.label);
}

function card(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findByType(GenreCard).props;
}

/** Press whichever article the current card is asking for. */
async function answer(
  tree: ReactTestRenderer.ReactTestRenderer,
  article: string,
) {
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === article);
  if (!text) {
    throw new Error(`no article ${article}`);
  }
  let node = text.parent;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`article ${article} has no pressable above it`);
  }
  await ReactTestRenderer.act(async () => {
    node!.props.onPress();
  });
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  await ReactTestRenderer.act(async () => {
    tree.root.findByProps({ label }).props.onPress();
  });
}

describe('GenreDrillScreen', () => {
  it('asks twenty questions, one at a time, and reveals after an answer', async () => {
    const { tree } = await renderDrill('practice');

    expect(texts(tree)).toContain(
      `01 / ${String(SESSION_SIZE).padStart(2, '0')}`,
    );
    // Nothing to advance to until the question has been answered.
    expect(labels(tree)).toEqual([]);

    const question = card(tree);
    await answer(tree, articleFor(question.gender));

    // The article that is right is on paper, and only then is there a way on.
    expect(texts(tree)).toContain(
      `${articleFor(question.gender)} ${question.word}`,
    );
    expect(labels(tree)).toEqual([copy.genreNext]);
  });

  it('walks the counter forward and ends on a paper', async () => {
    const { tree } = await renderDrill('practice');
    const first = card(tree).word;

    await answer(tree, articleFor(card(tree).gender));
    await press(tree, copy.genreNext);

    expect(texts(tree)).toContain(
      `02 / ${String(SESSION_SIZE).padStart(2, '0')}`,
    );
    expect(card(tree).word).not.toBe(first);
    expect(card(tree).picked).toBeNull();
  });

  it('writes every wrong practice answer into the ledger', async () => {
    const { tree } = await renderDrill('practice');

    for (let index = 0; index < SESSION_SIZE; index += 1) {
      const question = card(tree);
      const wrong = articleFor(question.gender) === 'le' ? 'la' : 'le';
      await answer(tree, wrong);
      await press(
        tree,
        index + 1 === SESSION_SIZE ? copy.genreFinish : copy.genreNext,
      );
    }

    expect(texts(tree)).toContain(copy.genreScore(0, SESSION_SIZE));
    expect(Object.keys(genreStore.getSnapshot().review.items)).toHaveLength(
      SESSION_SIZE,
    );
    expect(tree.root.findAllByType(VerdictStamp)).toHaveLength(0);
    // The paper offers another sitting and the review the mistakes opened.
    expect(labels(tree)).toContain(copy.genreAgain);
    expect(labels(tree)).toContain(copy.genreReview(SESSION_SIZE));
  });

  it('keeps a right practice answer out of the ledger and stamps a flawless paper', async () => {
    const { tree } = await renderDrill('practice');

    for (let index = 0; index < SESSION_SIZE; index += 1) {
      await answer(tree, articleFor(card(tree).gender));
      await press(
        tree,
        index + 1 === SESSION_SIZE ? copy.genreFinish : copy.genreNext,
      );
    }

    expect(texts(tree)).toContain(copy.genreScore(SESSION_SIZE, SESSION_SIZE));
    expect(genreStore.getSnapshot().review.items).toEqual({});
    expect(tree.root.findAllByType(VerdictStamp)).toHaveLength(1);
  });

  it('asks a review question with its box and looks its gloss up again', async () => {
    const { tree } = await renderDrill('review', [{ w: 'vie', g: 'f' }]);

    const question = card(tree);
    expect(question.reviewBox).toBe(1);
    expect(texts(tree)).toContain(copy.genreKind);
    expect(texts(tree)).toContain(copy.genreBoxTag(1));
    // The ledger stores the word and the box, never the gloss — the card must
    // fetch the one-line Chinese note back from the bank.
    expect(question.gloss).toBe(
      NOUNS.find(noun => noun.w === question.word)?.zh,
    );
    expect(question.gloss).not.toBe('');
  });

  it('moves a right review answer up a box and sends a wrong one back', async () => {
    const { tree } = await renderDrill('review', [
      { w: 'vie', g: 'f' },
      { w: 'temps', g: 'm' },
    ]);

    const first = card(tree);
    await answer(tree, articleFor(first.gender));
    await press(tree, copy.genreNext);

    const second = card(tree);
    await answer(tree, articleFor(second.gender) === 'le' ? 'la' : 'le');
    await press(tree, copy.genreFinish);

    const items = genreStore.getSnapshot().review.items;
    expect(items[first.word].box).toBe(2);
    expect(items[second.word].box).toBe(1);
    // The paper counts words, not right answers: a review is not a score.
    expect(
      texts(tree).some(text => text.startsWith(copy.genreReviewed(2))),
    ).toBe(true);
    expect(texts(tree)).not.toContain(copy.genreScore(2, 2));
  });

  it('sums the review paper up as boxes moved, not as a score', async () => {
    const { tree } = await renderDrill('review', [
      { w: 'vie', g: 'f' },
      { w: 'temps', g: 'm' },
    ]);

    await answer(tree, articleFor(card(tree).gender));
    await press(tree, copy.genreNext);
    const second = card(tree);
    await answer(tree, articleFor(second.gender) === 'le' ? 'la' : 'le');
    await press(tree, copy.genreFinish);

    const score = texts(tree).find(text => text === '2');
    expect(score).toBe('2');
    expect(texts(tree)).toContain(
      `${copy.genreReviewed(2)} · ${copy.genreAdvanced(
        1,
      )} · ${copy.genreSentBack(1)}`,
    ); // One word is due again at once; the other moved a day out.
    expect(labels(tree)).toContain(copy.genreReviewAgain(1));
  });

  it('says so when a review has nothing due, instead of asking an empty card', async () => {
    const { tree } = await renderDrill('review');

    expect(texts(tree)).toContain(copy.genreEmpty);
    expect(tree.root.findAllByType(GenreCard)).toHaveLength(0);
  });

  it('still asks a word the bank no longer carries, without a gloss', async () => {
    const { tree } = await renderDrill('review', [
      { w: 'mot-inconnu', g: 'm' },
    ]);

    const question = card(tree);
    expect(question.word).toBe('mot-inconnu');
    expect(question.gloss).toBe('');
    await answer(tree, articleFor(question.gender));
    expect(texts(tree)).toContain('le mot-inconnu');
    expect(genreStore.getSnapshot().review.items['mot-inconnu'].box).toBe(2);
  });

  it('leaves the sitting with the lobby behind it', async () => {
    const { tree, navigation } = await renderDrill('practice');

    // The question is still open, so there is no way on — the way back always
    // works, and it pops to the lobby rather than to the list.
    expect(labels(tree)).toEqual([]);
    const back = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === copy.backTo(copy.backFallback));
    let node = back!.parent;
    while (node && typeof node.props.onPress !== 'function') {
      node = node.parent;
    }
    await ReactTestRenderer.act(async () => {
      node!.props.onPress();
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

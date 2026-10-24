import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { OutlinedButton } from '../../src/components/OutlinedButton';
import { ARMED_MS } from '../../src/components/useArmedConfirm';
import { GenreLobbyScreen } from '../../src/screens/GenreLobbyScreen';
import { copy } from '../../src/copy';
import { emptyReview, recordWrong } from '../../src/domain/genre';
import type { ReviewState } from '../../src/domain/genre';
import { genreStore } from '../../src/storage/genreStore';

type ScreenProps = React.ComponentProps<typeof GenreLobbyScreen>;

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

/** Render the lobby with `held` words already in the ledger (due at once). */
async function renderLobby(held: readonly { w: string; g: 'm' | 'f' }[] = []) {
  // The ledger is the app singleton, so what the lobby reads is what was
  // actually written in this test.
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
        <GenreLobbyScreen
          navigation={navigation}
          route={{ key: 'Genre-1', name: 'Genre' } as ScreenProps['route']}
        />
      </SafeAreaProvider>,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return { tree: rendered, navigation };
}

/** The footer buttons, in the order they sit in. */
function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(OutlinedButton).map(node => node.props.label);
}

function disabledOf(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): boolean {
  return tree.root.findByProps({ label }).props.disabled;
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(node => {
    const { children } = node.props;
    return Array.isArray(children) ? children.join('') : String(children ?? '');
  });
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  await ReactTestRenderer.act(async () => {
    tree.root.findByProps({ label }).props.onPress();
  });
}

/** Press whatever pressable sits under a plain piece of text. */
async function pressText(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  if (!text) {
    throw new Error(`no text ${label}`);
  }
  let node = text.parent;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`text ${label} has no pressable above it`);
  }
  await ReactTestRenderer.act(async () => {
    node!.props.onPress();
  });
}

describe('GenreLobbyScreen', () => {
  it('offers the sitting and says the box is empty', async () => {
    const { tree } = await renderLobby();

    expect(labels(tree)).toEqual([copy.genreStart, copy.genreReviewEmpty]);
    expect(disabledOf(tree, copy.genreReviewEmpty)).toBe(true);
    // Nothing to clear, so the foot does not offer to clear it.
    expect(texts(tree)).not.toContain(copy.genreReset(1));
  });

  it('counts what the box owes, and offers to empty it', async () => {
    const { tree } = await renderLobby([{ w: 'vie', g: 'f' }]);

    expect(labels(tree)).toEqual([copy.genreStart, copy.genreReview(1)]);
    expect(disabledOf(tree, copy.genreReview(1))).toBe(false);
    expect(texts(tree)).toContain(copy.genreReset(1));
  });

  it('opens a practice sitting', async () => {
    const { tree, navigation } = await renderLobby();

    await press(tree, copy.genreStart);

    expect(navigation.navigate).toHaveBeenCalledWith('GenreDrill', {
      mode: 'practice',
    });
  });

  it('opens a review sitting', async () => {
    const { tree, navigation } = await renderLobby([{ w: 'vie', g: 'f' }]);

    await press(tree, copy.genreReview(1));

    expect(navigation.navigate).toHaveBeenCalledWith('GenreDrill', {
      mode: 'review',
    });
  });

  it('asks twice before it empties the ledger', async () => {
    const { tree } = await renderLobby([{ w: 'vie', g: 'f' }]);

    await pressText(tree, copy.genreReset(1));

    // First touch only asks: the ledger still holds the word.
    expect(texts(tree)).toContain(copy.genreResetSure);
    expect(genreStore.getSnapshot().review.items.vie).toBeDefined();

    await pressText(tree, copy.genreResetSure);

    expect(genreStore.getSnapshot().review.items).toEqual({});
    expect(texts(tree)).not.toContain(copy.genreReset(1));
  });

  it('drops a question that was never answered', async () => {
    const { tree } = await renderLobby([{ w: 'vie', g: 'f' }]);
    // Mounted on real timers, so only the countdown is faked.
    jest.useFakeTimers();
    try {
      await pressText(tree, copy.genreReset(1));
      expect(texts(tree)).toContain(copy.genreResetSure);

      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(ARMED_MS);
      });

      // Back to the idle word, and the box still holds the word: a question the
      // user never answered empties nothing.
      expect(texts(tree)).toContain(copy.genreReset(1));
      expect(texts(tree)).not.toContain(copy.genreResetSure);
      expect(genreStore.getSnapshot().review.items.vie).toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves the drill with the list behind it', async () => {
    const { tree, navigation } = await renderLobby();

    await pressText(tree, copy.backTo(copy.backFallback));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('credits the bank it asks about', async () => {
    const { tree } = await renderLobby();

    expect(texts(tree)).toContain(copy.genreCredit);
    expect(texts(tree)).toContain(copy.genreLeitner);
  });
});

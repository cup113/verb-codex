import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ConjugationRowView } from '../../src/components/ConjugationRowView';
import { copy } from '../../src/copy';
import { VerbDetailScreen } from '../../src/screens/VerbDetailScreen';
import { verbStore } from '../../src/storage/verbStore';

type ScreenProps = React.ComponentProps<typeof VerbDetailScreen>;

// The first render of this file transforms a large module graph on a cold
// cache, which easily overruns Jest's five-second default.
jest.setTimeout(60_000);

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
/** One of the entries the store seeds on a fresh codex. */
const ENTRY_ID = 'seed-aimer';

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

async function openEntry() {
  // The store is the app singleton, so the codex it loads is the real one.
  await ReactTestRenderer.act(async () => {
    await verbStore.init();
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
        <VerbDetailScreen
          navigation={navigation}
          route={
            {
              key: 'VerbDetail-1',
              name: 'VerbDetail',
              params: { verbId: ENTRY_ID },
            } as ScreenProps['route']
          }
        />
      </SafeAreaProvider>,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return rendered;
}

/** The six rows as the screen currently hands them to the grid. */
function rows(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(ConjugationRowView)
    .map(node => node.props.row);
}

describe('VerbDetailScreen', () => {
  it('shows the six recorded words the entry carries', async () => {
    const tree = await openEntry();

    expect(rows(tree).map(row => row.form)).toEqual([
      'aime',
      'aimes',
      'aime',
      'aimons',
      'aimez',
      'aiment',
    ]);
  });

  it('edits one row at a time and leaves the other five alone', async () => {
    const tree = await openEntry();

    await ReactTestRenderer.act(async () => {
      tree.root
        .findAllByType(ConjugationRowView)[4]
        .props.onChangeForm('allez');
    });

    const after = rows(tree);
    expect(after[4].form).toBe('allez');
    expect(after.slice(0, 4).map(row => row.form)).toEqual([
      'aime',
      'aimes',
      'aime',
      'aimons',
    ]);
    expect(after[5].form).toBe('aiment');
  });

  it('keeps every row in place during self-test and only sheds the fields', async () => {
    const tree = await openEntry();
    expect(tree.root.findAllByType(TextInput).length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      tree.root.findByProps({ label: copy.selfTest }).props.onPress();
    });

    // The card does not move: the six rows stay, read-only, and the words they
    // hold are the only thing that changes — they turn into masks.
    expect(tree.root.findAllByType(ConjugationRowView)).toHaveLength(6);
    expect(tree.root.findAllByType(ConjugationRowView)[0].props.editing).toBe(
      false,
    );
    expect(tree.root.findAllByType(ConjugationRowView)[0].props.revealed).toBe(
      false,
    );
    // Nothing on the card is typeable any more, and every row is still there.
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });
});

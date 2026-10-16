import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ConjugationRowView } from '../../src/components/ConjugationRowView';
import { RadicalField } from '../../src/components/RadicalField';
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
  return tree.root.findAllByType(ConjugationRowView).map(node => node.props.row);
}

describe('VerbDetailScreen', () => {
  it('opens on the radical the six rows already agree on', async () => {
    const tree = await openEntry();

    expect(tree.root.findByType(RadicalField).props.stem).toBe('aim');
  });

  it('hands one radical to all six rows, and leaves the endings alone', async () => {
    const tree = await openEntry();
    const before = rows(tree);

    await ReactTestRenderer.act(async () => {
      tree.root.findByType(RadicalField).props.onChange('aimer');
    });

    const after = rows(tree);
    expect(after.map(row => row.stem)).toEqual(Array(6).fill('aimer'));
    expect(after.map(row => row.ending)).toEqual(
      before.map(row => row.ending),
    );
  });

  it('still lets one row keep a radical of its own', async () => {
    const tree = await openEntry();

    await ReactTestRenderer.act(async () => {
      tree.root.findByType(RadicalField).props.onChange('aim');
    });
    await ReactTestRenderer.act(async () => {
      tree.root.findAllByType(ConjugationRowView)[4].props.onChangeStem('all');
    });

    // `aller` is recorded row by row: the fifth row keeps its own radical and
    // the other five are untouched.
    const after = rows(tree);
    expect(after[4].stem).toBe('all');
    expect(after.filter(row => row.stem === 'aim')).toHaveLength(5);
    // Six rows that no longer agree: the field stops claiming a value.
    expect(tree.root.findByType(RadicalField).props.stem).toBeNull();
  });

  it('keeps every row in place during self-test and only sheds the fields', async () => {
    const tree = await openEntry();
    expect(tree.root.findAllByType(TextInput).length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      tree.root.findByProps({ label: copy.selfTest }).props.onPress();
    });

    // The card does not move: the radical row stays, read-only, and so do the
    // six conjugation rows. The endings are the only thing that changes —
    // they turn into masks.
    const radical = tree.root.findByType(RadicalField);
    expect(radical.props.editing).toBe(false);
    expect(tree.root.findAllByType(ConjugationRowView)).toHaveLength(6);
    expect(tree.root.findAllByType(ConjugationRowView)[0].props.editing).toBe(
      false,
    );
    // Nothing on the card is typeable any more, and every row is still there.
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });
});

import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { VerbRow } from '../../src/components/VerbRow';
import { GroupTabs } from '../../src/components/GroupTabs';
import { copy } from '../../src/copy';
import { VerbListScreen } from '../../src/screens/VerbListScreen';
import { verbStore } from '../../src/storage/verbStore';

type ScreenProps = React.ComponentProps<typeof VerbListScreen>;

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

async function renderList() {
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
        <VerbListScreen
          navigation={navigation}
          route={
            { key: 'VerbList-1', name: 'VerbList' } as ScreenProps['route']
          }
        />
      </SafeAreaProvider>,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return { tree: rendered, navigation };
}

/** Every string the screen actually puts on paper. */
function screenText(tree: ReactTestRenderer.ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map(node => {
      const { children } = node.props;
      return Array.isArray(children)
        ? children.join('')
        : String(children ?? '');
    })
    .join('\n');
}

describe('VerbListScreen', () => {
  it('lists the seeded first-group entry under the paper header', async () => {
    const { tree } = await renderList();
    const screen = screenText(tree);

    expect(screen).toContain('Verbes');
    expect(screen).toContain('aimer');
    expect(screen).toContain('01 / 03');
    // Only the first group is on show, so a second-group verb stays out.
    expect(screen).not.toContain('finir');
  });

  it('opens the entry when its row is touched', async () => {
    const { tree, navigation } = await renderList();
    const rows = tree.root.findAllByType(VerbRow);
    expect(rows).toHaveLength(1);

    ReactTestRenderer.act(() => {
      rows[0].props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('VerbDetail', {
      verbId: 'seed-aimer',
    });
  });

  it('filters the list by group and counts what it shows', async () => {
    const { tree } = await renderList();

    await ReactTestRenderer.act(async () => {
      tree.root.findByType(GroupTabs).props.onChange(3);
    });

    const screen = screenText(tree);
    expect(screen).toContain('aller');
    expect(screen).not.toContain('aimer');
    expect(screen).toContain('01 / 03');
  });

  it('offers the recording action', async () => {
    const { tree, navigation } = await renderList();

    ReactTestRenderer.act(() => {
      tree.root.findByProps({ label: copy.newVerb }).props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('AddVerb');
  });
});

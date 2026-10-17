import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReactTestRenderer from 'react-test-renderer';
import { SearchField } from '../../src/components/SearchField';
import { VerbList } from '../../src/components/VerbList';
import { VerbRow } from '../../src/components/VerbRow';
import { GroupTabs } from '../../src/components/GroupTabs';
import { MoreButton, MoreMenu } from '../../src/components/MoreMenu';
import { copy } from '../../src/copy';
import { fonts } from '../../src/theme';
import { VerbListScreen } from '../../src/screens/VerbListScreen';
import { verbStore } from '../../src/storage/verbStore';
import { ownerStore } from '../../src/storage/ownerStore';

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
  // The stores are the app singletons, so the codex and the name they hand the
  // screen are the real ones.
  await ReactTestRenderer.act(async () => {
    await verbStore.init();
    await ownerStore.init();
  });
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  } as unknown as ScreenProps['navigation'];
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      // The draggable list uses gesture-handler, which refuses to mount its
      // detectors outside this root — in the app it wraps everything.
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <VerbListScreen
            navigation={navigation}
            route={
              { key: 'VerbList-1', name: 'VerbList' } as ScreenProps['route']
            }
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return { tree: rendered, navigation };
}

/** Type into the list's search field, as a keystroke would. */
function typeQuery(
  tree: ReactTestRenderer.ReactTestRenderer,
  text: string,
): void {
  ReactTestRenderer.act(() => {
    tree.root.findByType(SearchField).props.onChangeText(text);
  });
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

    expect(screen).toContain('Salut,');
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

    // The group the list is standing in travels with the entry: the way back
    // names it, even if the entry is moved from the detail screen.
    expect(navigation.navigate).toHaveBeenCalledWith('VerbDetail', {
      verbId: 'seed-aimer',
      group: 1,
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

    expect(navigation.navigate).toHaveBeenCalledWith('AddVerb', { group: 1 });
  });

  it('narrows the group to the entries whose own words match', async () => {
    const { tree } = await renderList();
    // Capitals on purpose: what was typed is folded before it is compared.
    typeQuery(tree, 'AIMONS');

    const rows = tree.root.findAllByType(VerbRow);
    expect(rows).toHaveLength(1);
    expect(rows[0].props.verb.infinitive).toBe('aimer');
    // The headword does not say why this entry is on show, so the row does.
    expect(rows[0].props.hint).toBe('nous aimons');
  });

  it('matches the headword without having to explain itself', async () => {
    const { tree } = await renderList();
    typeQuery(tree, 'aim');

    const rows = tree.root.findAllByType(VerbRow);
    expect(rows).toHaveLength(1);
    expect(rows[0].props.hint).toBeUndefined();
  });

  it('keeps the search inside the group on show', async () => {
    const { tree } = await renderList();
    typeQuery(tree, 'finis');

    // finir lives in the second group, so the first group has nothing to show.
    expect(tree.root.findAllByType(VerbRow)).toHaveLength(0);
    expect(screenText(tree)).toContain(copy.emptySearch);
    expect(screenText(tree)).toContain('00 / 03');

    await ReactTestRenderer.act(async () => {
      tree.root.findByType(GroupTabs).props.onChange(2);
    });

    const rows = tree.root.findAllByType(VerbRow);
    expect(rows).toHaveLength(1);
    expect(rows[0].props.verb.infinitive).toBe('finir');
    expect(rows[0].props.hint).toBe('je finis');
    // Switching tabs re-reads the same query rather than dropping it.
    expect(tree.root.findByType(SearchField).props.value).toBe('finis');
  });

  it('stops offering to reorder while the list is a subset', async () => {
    const { tree } = await renderList();
    expect(tree.root.findByType(VerbList).props.reorderEnabled).toBe(true);

    typeQuery(tree, 'aim');

    // The drop's index and pitch belong to the group, not to the subset.
    expect(tree.root.findByType(VerbList).props.reorderEnabled).toBe(false);
    expect(screenText(tree)).not.toContain(copy.longPressHint);
  });

  it('clears the search and hands the whole group back', async () => {
    const { tree } = await renderList();
    typeQuery(tree, 'chanter');
    expect(tree.root.findAllByType(VerbRow)).toHaveLength(0);

    ReactTestRenderer.act(() => {
      tree.root.findByType(SearchField).props.onClear();
    });

    expect(tree.root.findByType(SearchField).props.value).toBe('');
    expect(tree.root.findAllByType(VerbRow)).toHaveLength(1);
    expect(screenText(tree)).toContain('aimer');
  });

  it('keeps the name on the owner line, trimmed, once it is confirmed', async () => {
    const { tree } = await renderList();
    const line = () =>
      tree.root
        .findAllByType(TextInput)
        .find(node => node.props.placeholder === copy.namePlaceholder);

    expect(line()?.props.value).toBe('');

    // While the field has focus it holds exactly what was typed — spaces and
    // all — so trimming on commit cannot eat the space between two words.
    ReactTestRenderer.act(() => {
      line()!.props.onFocus();
      line()!.props.onChangeText('  Camille ');
    });
    expect(line()!.props.value).toBe('  Camille ');

    ReactTestRenderer.act(() => {
      line()!.props.onBlur();
    });

    expect(line()!.props.value).toBe('Camille');
    expect(ownerStore.getSnapshot().owner).toBe('Camille');

    // The store is shared with the rest of this file: leave it as it was found.
    await ReactTestRenderer.act(async () => {
      ownerStore.setOwner('');
      await ownerStore.flush();
    });
  });

  it("sets the owner's name in the codex's own italic", async () => {
    const { tree } = await renderList();
    const line = tree.root
      .findAllByType(TextInput)
      .find(node => node.props.placeholder === copy.namePlaceholder);

    // The name is the second half of the greeting, so it is set in the same
    // hand — and not in the face a *recorded* word wears.
    const set = StyleSheet.flatten(line!.props.style);
    expect(set.fontFamily).toBe(fonts.serifItalicHan);
    expect(set.fontFamily).not.toBe(fonts.serifMedium);
  });

  it('puts the search between the group tabs and the entries', async () => {
    const { tree } = await renderList();

    const order = tree.root
      .findAll(
        node =>
          node.type === GroupTabs ||
          node.type === SearchField ||
          node.type === VerbList,
      )
      .map(node => (node.type as { name: string }).name);

    expect(order).toEqual(['GroupTabs', 'SearchField', 'VerbList']);
  });

  it('keeps Sauvegarde in the ⋯ menu rather than in the header', async () => {
    const { tree, navigation } = await renderList();

    // Closed: neither the menu nor its label is on paper.
    expect(tree.root.findByType(MoreMenu).props.visible).toBe(false);
    expect(screenText(tree)).not.toContain(copy.backupLink);

    ReactTestRenderer.act(() => {
      tree.root.findByType(MoreButton).props.onPress();
    });

    expect(tree.root.findByType(MoreMenu).props.visible).toBe(true);
    expect(screenText(tree)).toContain(copy.backupLink);

    const label = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === copy.backupLink);
    let pressable = label!.parent;
    while (pressable && typeof pressable.props.onPress !== 'function') {
      pressable = pressable.parent;
    }
    ReactTestRenderer.act(() => {
      pressable!.props.onPress();
    });

    // Choosing it opens the backup screen and closes the menu behind itself.
    expect(navigation.navigate).toHaveBeenCalledWith('Backup');
    expect(tree.root.findByType(MoreMenu).props.visible).toBe(false);
  });
});

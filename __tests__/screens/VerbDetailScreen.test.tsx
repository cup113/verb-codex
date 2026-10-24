import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackHandler, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ConjugationRowView } from '../../src/components/ConjugationRowView';
import { DictationRow } from '../../src/components/DictationRow';
import { OutlinedButton } from '../../src/components/OutlinedButton';
import { ARMED_MS } from '../../src/components/useArmedConfirm';
import { VerdictStamp } from '../../src/components/VerdictStamp';
import { copy } from '../../src/copy';
import { seedVerbs } from '../../src/data/seed';
import { VerbDetailScreen } from '../../src/screens/VerbDetailScreen';
import { verbStore } from '../../src/storage/verbStore';
import { Group, GROUP_BACK_LABELS, GROUP_TAB_LABELS } from '../../src/types';

type ScreenProps = React.ComponentProps<typeof VerbDetailScreen>;

// The first render of this file transforms a large module graph on a cold
// cache, which easily overruns Jest's five-second default.
jest.setTimeout(60_000);

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
/** The navigation mock the last `openEntry` handed the screen. */
let lastNavigation: ScreenProps['navigation'];
/** One of the entries the store seeds on a fresh codex. */
const ENTRY_ID = 'seed-aimer';
/** The six words that entry records, in row order. */
const RECORDED = ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'];

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

async function openEntry(params: { group?: Group } = {}) {
  // The store is the app singleton, so the codex it loads is the real one.
  await ReactTestRenderer.act(async () => {
    await verbStore.init();
  });
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  } as unknown as ScreenProps['navigation'];
  lastNavigation = navigation;
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
              params: { verbId: ENTRY_ID, ...params },
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

/** The six rows as the screen currently hands them to a dictation. */
function dictation(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(DictationRow).map(node => node.props);
}

/** Every footer button, in the order they sit in. */
function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(OutlinedButton).map(node => node.props.label);
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(Text).map(node => node.props.children);
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  await ReactTestRenderer.act(async () => {
    tree.root.findByProps({ label }).props.onPress();
  });
}

async function type(
  tree: ReactTestRenderer.ReactTestRenderer,
  index: number,
  text: string,
) {
  await ReactTestRenderer.act(async () => {
    tree.root.findAllByType(DictationRow)[index].props.onChange(text);
  });
}

async function writeAll(
  tree: ReactTestRenderer.ReactTestRenderer,
  words: readonly string[],
) {
  for (let index = 0; index < words.length; index++) {
    await type(tree, index, words[index]);
  }
}

/** The corner's own buttons are labelled text, not OutlinedButtons. */
async function pressCorner(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    pressableFor(tree, label).props.onPress();
  });
}

/**
 * The nearest ancestor of `label` that carries `onPress`.
 *
 * `Pressable` is memo-wrapped, so it has no type a test can match; climbing
 * from the visible word is stable however many wrappers React Native puts in
 * between. The corner's two words and the picker's three groups are all just
 * labels on a pressable, so this is how they are touched.
 */
function pressableFor(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): ReactTestRenderer.ReactTestInstance {
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  if (!text) {
    throw new Error(`no label ${label} on screen`);
  }
  let node = text.parent;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`label ${label} has no pressable above it`);
  }
  return node;
}

/** A group in the picker, read off the node that announces itself as selected. */
function groupChoice(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): ReactTestRenderer.ReactTestInstance {
  let node: ReactTestRenderer.ReactTestInstance | null = pressableFor(
    tree,
    label,
  );
  while (node && node.props['aria-selected'] === undefined) {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`group ${label} does not say whether it is selected`);
  }
  return node;
}

async function pickGroup(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    pressableFor(tree, label).props.onPress();
  });
}

/** The group the store now records for an entry, if it is still there. */
function groupOf(verbId: string): Group | undefined {
  return verbStore.getSnapshot().verbs.find(verb => verb.id === verbId)?.group;
}

/**
 * Deleting and moving both edit the store, which is the app singleton: the
 * change really lands, so the codex is put back the way the rest of the file
 * expects to find it.
 */
async function restoreCodex() {
  await ReactTestRenderer.act(async () => {
    await verbStore.replaceAll(seedVerbs());
  });
}

describe('VerbDetailScreen', () => {
  it('shows the six recorded words the entry carries', async () => {
    const tree = await openEntry();

    expect(rows(tree).map(row => row.form)).toEqual(RECORDED);
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

    await press(tree, copy.selfTest);

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

  it('sets the dictation to the left of self-test, greyed out until six rows are written', async () => {
    const tree = await openEntry();

    expect(labels(tree)).toEqual([copy.dictate, copy.selfTest]);
    expect(tree.root.findByProps({ label: copy.dictate }).props.disabled).toBe(
      false,
    );

    // An entry missing a row has nothing to compare against in that row, so
    // the mode is offered but not enterable.
    await ReactTestRenderer.act(async () => {
      verbStore.setRow(ENTRY_ID, 3, { form: '' });
    });
    expect(tree.root.findByProps({ label: copy.dictate }).props.disabled).toBe(
      true,
    );

    await ReactTestRenderer.act(async () => {
      verbStore.setRow(ENTRY_ID, 3, { form: 'aimons' });
    });
    expect(tree.root.findByProps({ label: copy.dictate }).props.disabled).toBe(
      false,
    );
  });

  it('empties the six fields, hides the note and locks the infinitive in a dictation', async () => {
    const tree = await openEntry();

    await press(tree, copy.dictate);

    expect(tree.root.findAllByType(ConjugationRowView)).toHaveLength(0);
    const dictating = dictation(tree);
    expect(dictating).toHaveLength(6);
    expect(dictating.map(row => row.value)).toEqual(['', '', '', '', '', '']);
    expect(dictating.map(row => row.verdict)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    // The pronouns stay: they are the prompt, not the thing to recall.
    expect(dictating.map(row => row.pronoun)).toEqual([
      "j'",
      'tu',
      'il / elle',
      'nous',
      'vous',
      'ils / elles',
    ]);
    expect(texts(tree)).toContain(copy.tipWrite);
    expect(texts(tree)).toContain('aimer');
    // The note is a hint, and hints and answers are two sides of one paper.
    expect(
      tree.root.findAllByProps({ placeholder: copy.notePlaceholder }),
    ).toHaveLength(0);
    // The infinitive still reads on the card, but it is not the user's to edit
    // while the paper is out.
    expect(tree.root.findAllByProps({ maxLength: 40 })).toHaveLength(0);
  });

  it('crosses out what the check found wrong and leaves the rest inked', async () => {
    const tree = await openEntry();
    await press(tree, copy.dictate);
    await writeAll(tree, ['aime', 'aime', 'aime', 'aimons', 'aimez', 'aiment']);

    await press(tree, copy.verify);

    expect(dictation(tree).map(row => row.verdict)).toEqual([
      'ok',
      'bad',
      'ok',
      'ok',
      'ok',
      'ok',
    ]);
    expect(texts(tree)).toContain(copy.tipCorrect);
    // A paper with a fault on it is not a finished paper.
    expect(tree.root.findAllByType(VerdictStamp)).toHaveLength(0);
    expect(labels(tree)).toEqual([copy.quit, copy.verify]);
  });

  it('withdraws a verdict as soon as the user edits that row', async () => {
    const tree = await openEntry();
    await press(tree, copy.dictate);
    await writeAll(tree, ['aime', 'aime', 'aime', 'aimons', 'aimez', 'aiment']);
    await press(tree, copy.verify);

    await type(tree, 1, 'aimes');

    const dictating = dictation(tree);
    expect(dictating[1].verdict).toBeNull();
    // The rows that came out right are untouched by another row's correction.
    expect(dictating[0].verdict).toBe('ok');
    expect(dictating[3].verdict).toBe('ok');
    expect(texts(tree)).toContain(copy.tipWrite);
  });

  it('stamps a paper that was right the first time', async () => {
    const tree = await openEntry();
    await press(tree, copy.dictate);
    await writeAll(tree, RECORDED);

    await press(tree, copy.verify);

    expect(tree.root.findByType(VerdictStamp).props.tier).toBe('flawless');
    expect(labels(tree)).toEqual([copy.again, copy.proceed]);
    expect(dictation(tree).every(row => row.verdict === 'ok')).toBe(true);
    // Inked row by row, rather than all at once: the paper dries in order.
    expect(dictation(tree).map(row => row.settleDelay)).toEqual([
      0, 90, 180, 270, 360, 450,
    ]);
  });

  it('gives a corrected paper the smaller stamp', async () => {
    const tree = await openEntry();
    await press(tree, copy.dictate);
    await writeAll(tree, ['aime', 'aime', 'aime', 'aimons', 'aimez', 'aiment']);
    await press(tree, copy.verify);
    await type(tree, 1, 'aimes');

    await press(tree, copy.verify);

    expect(tree.root.findByType(VerdictStamp).props.tier).toBe('corrected');
    // A corrected paper is not inked row by row: only a flawless one is.
    expect(dictation(tree).map(row => row.settleDelay)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });

  it('keeps no draft: Encore hands back an empty paper', async () => {
    const tree = await openEntry();
    await press(tree, copy.dictate);
    await writeAll(tree, RECORDED);
    await press(tree, copy.verify);

    await press(tree, copy.again);

    expect(tree.root.findAllByType(VerdictStamp)).toHaveLength(0);
    expect(dictation(tree).map(row => row.value)).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(dictation(tree).map(row => row.verdict)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(texts(tree)).toContain(copy.tipWrite);
  });

  it('keeps no draft: quitting and coming back starts the paper over', async () => {
    const tree = await openEntry();
    await press(tree, copy.dictate);
    await type(tree, 0, 'aime');

    await press(tree, copy.quit);

    expect(tree.root.findAllByType(ConjugationRowView)).toHaveLength(6);
    expect(
      tree.root.findAllByProps({ placeholder: copy.notePlaceholder }).length,
    ).toBeGreaterThan(0);

    await press(tree, copy.dictate);
    expect(dictation(tree).map(row => row.value)).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it('leaves the dictation before it leaves the entry on the Android back key', async () => {
    const addEventListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    const tree = await openEntry();
    await press(tree, copy.dictate);

    const handler = addEventListener.mock.calls[
      addEventListener.mock.calls.length - 1
    ][1] as () => boolean;
    let handled = false;
    await ReactTestRenderer.act(async () => {
      handled = handler();
    });

    expect(handled).toBe(true);
    expect(tree.root.findAllByType(DictationRow)).toHaveLength(0);
    expect(tree.root.findAllByType(ConjugationRowView)).toHaveLength(6);
    addEventListener.mockRestore();
  });
});

/**
 * The two questions the corner can ask — « did you mean to delete this? » and
 * « which group is this? ». Both are answered in place, on the paper the entry
 * is written on: no dialog is laid over the entry being read, and each takes
 * one touch to ask and one to answer.
 */
describe('VerbDetailScreen: the corner', () => {
  it('arms on the first touch and deletes on the second', async () => {
    const tree = await openEntry();

    await pressCorner(tree, copy.delete);

    // The first touch only asks: the corner changes its word and nothing else.
    expect(texts(tree)).toContain(copy.deleteSure);
    expect(texts(tree)).not.toContain(copy.delete);
    expect(groupOf(ENTRY_ID)).toBe(1);

    await pressCorner(tree, copy.deleteSure);
    await ReactTestRenderer.act(async () => {});

    // The second one does the deed, and leaves the entry that no longer exists.
    expect(groupOf(ENTRY_ID)).toBeUndefined();
    expect(lastNavigation.goBack).toHaveBeenCalled();
    await restoreCodex();
  });

  it('drops a question that was never answered', async () => {
    const tree = await openEntry();
    // Mounted on real timers, so only the countdown is faked.
    jest.useFakeTimers();
    try {
      await pressCorner(tree, copy.delete);
      expect(texts(tree)).toContain(copy.deleteSure);

      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(ARMED_MS);
      });

      // Back to the idle word, and nothing was deleted: a question the user
      // never answered deletes nothing.
      expect(texts(tree)).toContain(copy.delete);
      expect(texts(tree)).not.toContain(copy.deleteSure);
      expect(groupOf(ENTRY_ID)).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows the three groups in the library tabs' own words, the current one marked", async () => {
    const tree = await openEntry();
    expect(texts(tree)).not.toContain(GROUP_TAB_LABELS[3]);

    await pressCorner(tree, copy.move);

    expect(texts(tree)).toContain(GROUP_TAB_LABELS[1]);
    expect(texts(tree)).toContain(GROUP_TAB_LABELS[2]);
    expect(texts(tree)).toContain(GROUP_TAB_LABELS[3]);
    expect(groupChoice(tree, GROUP_TAB_LABELS[1]).props['aria-selected']).toBe(
      true,
    );
    expect(groupChoice(tree, GROUP_TAB_LABELS[2]).props['aria-selected']).toBe(
      false,
    );
  });

  it('moves the entry and folds the picker away', async () => {
    const tree = await openEntry();
    await pressCorner(tree, copy.move);

    await pickGroup(tree, GROUP_TAB_LABELS[2]);

    expect(groupOf(ENTRY_ID)).toBe(2);
    expect(texts(tree)).not.toContain(GROUP_TAB_LABELS[3]);
    await restoreCodex();
  });

  it('closes the picker without a move when the current group is touched', async () => {
    const tree = await openEntry();
    await pressCorner(tree, copy.move);

    await pickGroup(tree, GROUP_TAB_LABELS[1]);

    expect(groupOf(ENTRY_ID)).toBe(1);
    expect(texts(tree)).not.toContain(GROUP_TAB_LABELS[3]);
  });

  it('keeps one question at a time in the corner', async () => {
    const tree = await openEntry();

    await pressCorner(tree, copy.delete);
    expect(texts(tree)).toContain(copy.deleteSure);

    // Asking about the group drops the armed delete…
    await pressCorner(tree, copy.move);
    expect(texts(tree)).not.toContain(copy.deleteSure);
    expect(texts(tree)).toContain(GROUP_TAB_LABELS[1]);

    // …and arming the delete again folds the picker away.
    await pressCorner(tree, copy.delete);
    expect(texts(tree)).not.toContain(GROUP_TAB_LABELS[1]);
    expect(texts(tree)).toContain(copy.deleteSure);
  });

  it("names the group the list behind stands in, not the entry's own", async () => {
    const tree = await openEntry({ group: 1 });
    expect(texts(tree)).toContain(copy.backTo(GROUP_BACK_LABELS[1]));

    await pressCorner(tree, copy.move);
    await pickGroup(tree, GROUP_TAB_LABELS[2]);

    // The entry really moved, and the way back still goes to the list this
    // screen was opened from — the signpost did not move with the entry.
    expect(groupOf(ENTRY_ID)).toBe(2);
    expect(texts(tree)).toContain(copy.backTo(GROUP_BACK_LABELS[1]));
    await restoreCodex();
  });

  it("falls back to the entry's own group when the route carries none", async () => {
    const tree = await openEntry();

    expect(texts(tree)).toContain(copy.backTo(GROUP_BACK_LABELS[1]));
  });

  it('drops its question before the Android back key leaves the entry', async () => {
    const addEventListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    const tree = await openEntry();
    await pressCorner(tree, copy.delete);
    await pressCorner(tree, copy.move);
    expect(texts(tree)).toContain(GROUP_TAB_LABELS[1]);

    const handler = addEventListener.mock.calls[
      addEventListener.mock.calls.length - 1
    ][1] as () => boolean;
    let handled = false;
    await ReactTestRenderer.act(async () => {
      handled = handler();
    });

    // Back meant "never mind", not "leave": the picker folded and the entry is
    // still here.
    expect(handled).toBe(true);
    expect(texts(tree)).not.toContain(GROUP_TAB_LABELS[1]);
    expect(texts(tree)).not.toContain(copy.deleteSure);
    expect(groupOf(ENTRY_ID)).toBe(1);
    addEventListener.mockRestore();
  });
});

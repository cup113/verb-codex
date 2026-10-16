import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackHandler, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ConjugationRowView } from '../../src/components/ConjugationRowView';
import { DictationRow } from '../../src/components/DictationRow';
import { OutlinedButton } from '../../src/components/OutlinedButton';
import { VerdictStamp } from '../../src/components/VerdictStamp';
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
/** The six words that entry records, in row order. */
const RECORDED = ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'];

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

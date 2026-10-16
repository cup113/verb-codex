import React from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ConjugationRowView } from '../../src/components/ConjugationRowView';
import { copy } from '../../src/copy';

type Props = React.ComponentProps<typeof ConjugationRowView>;

function render(overrides: Partial<Props> = {}) {
  const onChangeStem = jest.fn();
  const onChangeEnding = jest.fn();
  const onReveal = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ConjugationRowView
        rowIndex={0}
        row={{ stem: 'aim', ending: 'e' }}
        editing
        revealed={false}
        onReveal={onReveal}
        onChangeStem={onChangeStem}
        onChangeEnding={onChangeEnding}
        {...overrides}
      />,
    );
  });
  return {
    tree: tree as ReactTestRenderer.ReactTestRenderer,
    onChangeStem,
    onChangeEnding,
    onReveal,
  };
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(Text).map(node => node.props.children);
}

describe('ConjugationRowView', () => {
  it('exposes both halves as typed text while editing', () => {
    const { tree } = render();

    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs.map(input => input.props.value)).toEqual(['aim', 'e']);
  });

  it('routes each half to its own change handler', () => {
    const { tree, onChangeStem, onChangeEnding } = render();
    const [stem, ending] = tree.root.findAllByType(TextInput);

    ReactTestRenderer.act(() => stem.props.onChangeText('aim'));
    ReactTestRenderer.act(() => ending.props.onChangeText('e'));

    expect(onChangeStem).toHaveBeenCalledWith('aim');
    expect(onChangeEnding).toHaveBeenCalledWith('e');
  });

  it('is not editable during self-test', () => {
    const { tree } = render({ editing: false });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('hides the ending behind the mask and keeps the stem in sight', () => {
    const { tree } = render({ editing: false, revealed: false });

    expect(texts(tree)).toContain('aim');
    expect(texts(tree)).toContain(copy.masked);
    expect(texts(tree)).not.toContain('e');
  });

  it('shows the recorded ending once the row is revealed', () => {
    const { tree } = render({ editing: false, revealed: true });

    expect(texts(tree)).toContain('e');
    expect(texts(tree)).not.toContain(copy.masked);
  });

  it('reveals the row the user touches, and only then', () => {
    const { tree, onReveal } = render({ editing: false, revealed: false });
    const row = tree.root.findAll(node => node.props.onPress === onReveal);

    expect(onReveal).not.toHaveBeenCalled();
    expect(row).toHaveLength(1);

    ReactTestRenderer.act(() => row[0].props.onPress());

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('elides the first person when the row starts with a vowel', () => {
    const elided = render({ rowIndex: 0, row: { stem: 'aim', ending: 'e' } });
    const bareEnding = render({
      rowIndex: 0,
      row: { stem: '', ending: 'ai' },
    });
    const consonant = render({
      rowIndex: 0,
      row: { stem: 'fin', ending: 'is' },
    });
    const plural = render({
      rowIndex: 3,
      row: { stem: 'fin', ending: 'issons' },
    });

    expect(texts(elided.tree)).toContain("j'");
    expect(texts(bareEnding.tree)).toContain("j'");
    expect(texts(consonant.tree)).toContain('je');
    expect(texts(plural.tree)).toContain('nous');
  });
});

/** The invisible copy of the stem the web measures the field from. */
function measuredCopy(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    node => node.type === Text && node.props.onLayout !== undefined,
  );
}

describe('ConjugationRowView on the web', () => {
  // Jest runs the native program, so the web branch has to be asked for. A bare
  // <input> there takes the browser's default width instead of its text's, and
  // that is the whole reason the copy below exists.
  const nativeOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = nativeOS;
  });

  it('lays the stem out as text until it has a width to pin', () => {
    const { tree } = render();
    const [copyOfStem] = measuredCopy(tree);

    expect(copyOfStem).toBeDefined();
    expect(copyOfStem.props.children).toBe('aim');
    // In flow, so the very first paint already hugs the text...
    expect(StyleSheet.flatten(copyOfStem.props.style).position).toBeUndefined();
    // ...and no stem field yet (the ending is the row's only one), so nothing
    // can show the browser's default width before the measurement lands.
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].props.value).toBe('e');
  });

  it('gives an empty stem a copy too, so a blank row still measures', () => {
    const { tree } = render({ row: { stem: '', ending: '' } });

    expect(measuredCopy(tree)[0].props.children).toBe(' ');
  });

  it('pins the stem field to the width that copy reports', () => {
    const { tree } = render();

    ReactTestRenderer.act(() =>
      measuredCopy(tree)[0].props.onLayout({
        nativeEvent: { layout: { width: 41.4 } },
      }),
    );

    const [stem, ending] = tree.root.findAllByType(TextInput);
    expect(StyleSheet.flatten(stem.props.style).width).toBe(44);
    expect(ending.props.value).toBe('e');
    // The copy steps behind the field, invisible but still laid out — still
    // measuring, this time as the text changes under the user's fingers.
    const [copyOfStem] = measuredCopy(tree);
    expect(StyleSheet.flatten(copyOfStem.props.style).opacity).toBe(0);
    expect(StyleSheet.flatten(copyOfStem.props.style).position).toBe(
      'absolute',
    );
  });

  it('leaves the fields alone where the platform measures them itself', () => {
    Platform.OS = 'ios';
    const { tree } = render();

    expect(measuredCopy(tree)).toHaveLength(0);
    const [stem] = tree.root.findAllByType(TextInput);
    expect(StyleSheet.flatten(stem.props.style).width).toBeUndefined();
  });
});

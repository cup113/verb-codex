import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { RadicalField } from '../../src/components/RadicalField';
import { copy } from '../../src/copy';

type Props = React.ComponentProps<typeof RadicalField>;

function render(stem: Props['stem'], editing = true, onChange = jest.fn()) {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <RadicalField stem={stem} editing={editing} onChange={onChange} />,
    );
  });
  return {
    tree: tree as ReactTestRenderer.ReactTestRenderer,
    onChange,
  };
}

function input(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(TextInput)[0];
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(Text).map(node => node.props.children);
}

describe('RadicalField', () => {
  it('shows the radical the six rows agree on', () => {
    const { tree } = render('aim');

    expect(input(tree).props.value).toBe('aim');
    expect(input(tree).props.placeholder).toBe(copy.radicalPlaceholder);
  });

  it('invites a radical on a fresh entry without pretending to hold one', () => {
    const { tree } = render('');

    expect(input(tree).props.value).toBe('');
    expect(input(tree).props.placeholder).toBe(copy.radicalPlaceholder);
  });

  it('shows a placeholder rather than pick one row’s value when they differ', () => {
    const { tree } = render(null);

    expect(input(tree).props.value).toBe('');
    expect(input(tree).props.placeholder).toBe(copy.radicalMixed);
  });

  it('hands every keystroke to the caller', () => {
    const { tree, onChange } = render('');

    ReactTestRenderer.act(() => input(tree).props.onChangeText('aim'));

    expect(onChange).toHaveBeenCalledWith('aim');
  });

  it('labels itself with the word the grid uses for the stem', () => {
    const { tree } = render('aim');

    expect(texts(tree)).toContain(copy.radical);
  });

  it('drops its field in self-test but keeps its place and its text', () => {
    const { tree } = render('aim', false);

    // Nothing left to type into, and no placeholder standing in for a value…
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    // …the recorded radical is on paper, exactly where the field was.
    expect(texts(tree)).toEqual([copy.radical, 'aim']);
  });

  it('reads a disagreement as variable in self-test too', () => {
    const { tree } = render(null, false);

    expect(texts(tree)).toEqual([copy.radical, copy.radicalMixed]);
  });
});

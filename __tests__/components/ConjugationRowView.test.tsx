import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ConjugationRowView } from '../../src/components/ConjugationRowView';
import { copy } from '../../src/copy';
import { colors } from '../../src/theme';

type Props = React.ComponentProps<typeof ConjugationRowView>;

function render(overrides: Partial<Props> = {}) {
  const onChangeForm = jest.fn();
  const onReveal = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ConjugationRowView
        rowIndex={0}
        row={{ form: 'aime' }}
        editing
        revealed={false}
        onReveal={onReveal}
        onChangeForm={onChangeForm}
        {...overrides}
      />,
    );
  });
  return {
    tree: tree as ReactTestRenderer.ReactTestRenderer,
    onChangeForm,
    onReveal,
  };
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(Text).map(node => node.props.children);
}

/** Every colour the row actually paints text in. */
function textColors(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root
    .findAllByType(Text)
    .map(node => StyleSheet.flatten(node.props.style)?.color);
}

describe('ConjugationRowView', () => {
  it('exposes the recorded word as one field while editing', () => {
    const { tree } = render();

    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs.map(input => input.props.value)).toEqual(['aime']);
  });

  it('routes the whole word to its change handler', () => {
    const { tree, onChangeForm } = render();

    ReactTestRenderer.act(() =>
      tree.root.findByType(TextInput).props.onChangeText('aimons'),
    );

    expect(onChangeForm).toHaveBeenCalledWith('aimons');
  });

  it('is not editable during self-test', () => {
    const { tree } = render({ editing: false });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('hides the whole word behind the mask, and nothing else', () => {
    const { tree } = render({ editing: false, revealed: false });

    expect(texts(tree)).toContain(copy.masked);
    expect(texts(tree)).not.toContain('aime');
    // The pronoun stays in sight: only the word is the thing to recall.
    expect(texts(tree)).toContain("j'");
  });

  it('shows the recorded word, whole, once the row is revealed', () => {
    const { tree } = render({ editing: false, revealed: true });

    expect(texts(tree)).toContain('aime');
    expect(texts(tree)).not.toContain(copy.masked);
  });

  it('paints the whole word in one colour', () => {
    // The user's own words: "the whole word in the same colour". A row that
    // still split itself into a stem and an ending would show terracotta.
    const editing = render();
    const reading = render({ editing: false, revealed: true });
    const masked = render({ editing: false, revealed: false });

    [editing.tree, reading.tree, masked.tree].forEach(tree => {
      expect(textColors(tree)).not.toContain(colors.terracotta);
    });
    expect(textColors(reading.tree)).toContain(colors.ink);
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
    const elided = render({ rowIndex: 0, row: { form: 'aime' } });
    const bare = render({ rowIndex: 0, row: { form: 'ai' } });
    const consonant = render({ rowIndex: 0, row: { form: 'finis' } });
    const plural = render({ rowIndex: 3, row: { form: 'finissons' } });

    expect(texts(elided.tree)).toContain("j'");
    expect(texts(bare.tree)).toContain("j'");
    expect(texts(consonant.tree)).toContain('je');
    expect(texts(plural.tree)).toContain('nous');
  });
});

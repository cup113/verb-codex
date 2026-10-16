import React from 'react';
import { Animated, StyleSheet, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { DictationRow } from '../../src/components/DictationRow';
import { copy } from '../../src/copy';
import { colors } from '../../src/theme';

type Props = React.ComponentProps<typeof DictationRow>;

const base: Props = {
  pronoun: "j'",
  value: '',
  verdict: null,
  settleDelay: 0,
  onChange: () => {},
};

const rendered: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  // Rows carry animation timers; leaving them mounted past the test would let a
  // delayed frame land in a torn-down environment.
  rendered.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  rendered.length = 0;
});

function render(overrides: Partial<Props> = {}) {
  const onChange = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <DictationRow {...base} onChange={onChange} {...overrides} />,
    );
  });
  const mounted = tree as ReactTestRenderer.ReactTestRenderer;
  rendered.push(mounted);
  return {
    tree: mounted,
    onChange,
    update: (next: Partial<Props>) =>
      ReactTestRenderer.act(() => {
        mounted.update(
          <DictationRow {...base} onChange={onChange} {...overrides} {...next} />,
        );
      }),
  };
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(Text).map(node => node.props.children);
}

/** The style the row's one field actually carries. */
function fieldStyle(tree: ReactTestRenderer.ReactTestRenderer) {
  return StyleSheet.flatten(tree.root.findByType(TextInput).props.style);
}

/** The colour of the dashed rule under the field. */
function ruleColors(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root
    .findAll(node => node.props.style !== undefined)
    .map(node => StyleSheet.flatten(node.props.style)?.borderBottomColor)
    .filter(color => color !== undefined);
}

describe('DictationRow', () => {
  it('waits for a word in an editable field, in the writing colour', () => {
    const { tree } = render();

    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(fieldStyle(tree).color).toBe(colors.terracotta);
    // The pronoun stays in sight: only the word is the thing to recall, and the
    // empty field says nothing about the word that belongs in it.
    expect(texts(tree)).toContain("j'");
    expect(tree.root.findByType(TextInput).props.placeholder).toBe(copy.masked);
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });

  it('routes the whole word to its change handler', () => {
    const { tree, onChange } = render();

    ReactTestRenderer.act(() =>
      tree.root.findByType(TextInput).props.onChangeText('aimons'),
    );

    expect(onChange).toHaveBeenCalledWith('aimons');
  });

  it('crosses out an attempt the check called wrong, and keeps it editable', () => {
    const { tree } = render({ value: 'aime', verdict: 'bad' });

    expect(fieldStyle(tree).color).toBe(colors.terracotta);
    expect(fieldStyle(tree).textDecorationLine).toBe('line-through');
    // Still the user's paper to correct: the field has not been taken away.
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  });

  it('draws a fault mark on a wrong row that has nothing to cross out', () => {
    const { tree } = render({ value: '', verdict: 'bad' });

    expect(fieldStyle(tree).textDecorationLine).toBeUndefined();
    expect(ruleColors(tree)).toContain(colors.terracotta);
  });

  it('inks the word in, and stops editing it, once it matched', () => {
    const { tree } = render({ value: 'aime', verdict: 'ok' });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    const settled = tree.root.findAllByType(Text).map(node => ({
      text: node.props.children,
      color: StyleSheet.flatten(node.props.style)?.color,
    }));
    expect(settled).toContainEqual({ text: 'aime', color: colors.ink });
  });

  it('inks the recorded word, not the whitespace around what was typed', () => {
    const { tree } = render({ value: '  aime  ', verdict: 'ok' });

    expect(texts(tree)).toContain('aime');
    expect(texts(tree)).not.toContain('  aime  ');
  });

  it('shakes the row the check found at fault, and only that moment', () => {
    const sequence = jest.spyOn(Animated, 'sequence');
    const { update } = render({ value: 'aime' });
    expect(sequence).not.toHaveBeenCalled();

    update({ verdict: 'bad' });

    expect(sequence).toHaveBeenCalledTimes(1);
    sequence.mockRestore();
  });

  it('does not shake a row that came out right', () => {
    const sequence = jest.spyOn(Animated, 'sequence');
    render({ value: 'aime', verdict: 'ok' });

    expect(sequence).not.toHaveBeenCalled();
    sequence.mockRestore();
  });

  it('gives each row its turn when a flawless paper is inked', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render({ value: 'aime', verdict: 'ok', settleDelay: 270 });

    const delays = timing.mock.calls.map(call => call[1].delay);
    expect(delays).toContain(270);
    timing.mockRestore();
  });

  it('settles in place: a matched word is never struck through', () => {
    const { tree } = render({ value: 'aime', verdict: 'ok' });

    const decorations = tree.root
      .findAllByType(Text)
      .map(node => StyleSheet.flatten(node.props.style)?.textDecorationLine);
    expect(decorations).not.toContain('line-through');
  });
});

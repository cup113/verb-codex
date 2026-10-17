import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { VerbRow } from '../../src/components/VerbRow';
import { emptyRows } from '../../src/domain/verbs';
import { colors } from '../../src/theme';
import { Verb } from '../../src/types';

const SIX = ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'];

function verb(forms: readonly string[]): Verb {
  return {
    id: 'v1',
    infinitive: 'aimer',
    group: 1,
    tense: 'present',
    rows: emptyRows().map((row, index) =>
      forms[index] === undefined ? row : { form: forms[index] },
    ),
    note: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

function render(forms: readonly string[]): ReactTestRenderer.ReactTestRenderer {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <VerbRow verb={verb(forms)} onPress={() => {}} />,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return rendered;
}

/**
 * The node that draws the tick, or undefined when the row draws a ring.
 *
 * The tick is two borders of one box turned 45°, and nothing else in a row is
 * transformed — so a rotation in the tree *is* the tick, which is as close as a
 * test can come to a drawing.
 */
function tickNode(
  tree: ReactTestRenderer.ReactTestRenderer,
): ReactTestRenderer.ReactTestInstance | undefined {
  return tree.root.findAll(node => {
    const style = node.props?.style;
    const flat = Array.isArray(style) ? style : [style];
    return flat.some(entry => entry?.transform !== undefined);
  })[0];
}

function drawsTick(tree: ReactTestRenderer.ReactTestRenderer): boolean {
  return tickNode(tree) !== undefined;
}

describe('VerbRow', () => {
  it('draws the tick only once all six rows are written', () => {
    expect(drawsTick(render(SIX))).toBe(true);
    expect(drawsTick(render(['aime', 'aimes']))).toBe(false);
    // Whitespace is not a recorded word, so it does not close the sixth row.
    expect(drawsTick(render([...SIX.slice(0, 5), '   ']))).toBe(false);
  });

  it('says how much is on paper, now that the mark is drawn rather than written', () => {
    // Read off whichever node carries it: `Pressable` is memo-wrapped, so it
    // has no type a test can match — the prop itself is the stable handle.
    const label = (tree: ReactTestRenderer.ReactTestRenderer): string =>
      tree.root.findAll(
        node => node.props?.accessibilityLabel !== undefined,
      )[0].props.accessibilityLabel;

    expect(label(render(SIX))).toBe('aimer, 6 lignes sur 6');
    expect(label(render(['aime', 'aimes']))).toBe('aimer, 2 lignes sur 6');
  });

  it('draws the mark in the diluted accent rather than the accent itself', () => {
    // A completed entry is a record, not a call to action: the tick is asked
    // for in a lighter brown than the terracotta the rest of the screen uses,
    // and this is the assertion that keeps it there.
    const style = StyleSheet.flatten(tickNode(render(SIX))!.props.style);
    expect(style.borderColor).toBe(colors.terracottaSoft);
    // The two palette values really are different: without this the assertion
    // above would still pass if the mark were folded back onto the accent.
    expect(colors.terracottaSoft).not.toBe(colors.terracotta);
  });
});

import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SearchField } from '../../src/components/SearchField';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

function render(
  value: string,
  handlers: {
    onChangeText?: (text: string) => void;
    onClear?: () => void;
  } = {},
): ReactTestRenderer.ReactTestRenderer {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SearchField
        value={value}
        onChangeText={handlers.onChangeText ?? (() => {})}
        onClear={handlers.onClear ?? (() => {})}
      />,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return rendered;
}

/**
 * How many drawn parts are turned on an angle — which in this field is the
 * magnifier's handle and nothing else.
 *
 * Host nodes only: a composite `View` and the host element it renders both
 * appear in the traversal carrying the same style, so counting instances would
 * count every drawn part twice.
 */
function turnedParts(tree: ReactTestRenderer.ReactTestRenderer): number {
  return tree.root.findAll(node => {
    if (typeof node.type !== 'string') {
      return false;
    }
    const style = node.props?.style;
    const flat = Array.isArray(style) ? style : [style];
    return flat.some(entry => entry?.transform !== undefined);
  }).length;
}

/** Press whatever carries `label`: `Pressable` has no type a test can match. */
function pressLabelled(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): void {
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  if (!text) {
    throw new Error(`no label ${label} in the field`);
  }
  let node = text.parent;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`label ${label} has no pressable above it`);
  }
  ReactTestRenderer.act(() => {
    node!.props.onPress();
  });
}

describe('SearchField', () => {
  it('draws its own magnifier instead of borrowing a glyph', () => {
    expect(turnedParts(render(''))).toBe(1);
  });

  it('offers to clear only once something has been typed', () => {
    expect(render('').root.findAllByType(Text)).toHaveLength(0);
    expect(
      render('aim')
        .root.findAllByType(Text)
        .map(node => node.props.children),
    ).toEqual(['✕']);
  });

  it('hands a keystroke and the clear tap back to the screen', () => {
    const onChangeText = jest.fn();
    const onClear = jest.fn();
    const tree = render('aim', { onChangeText, onClear });

    ReactTestRenderer.act(() => {
      tree.root.findByType(TextInput).props.onChangeText('aime');
    });
    expect(onChangeText).toHaveBeenCalledWith('aime');

    pressLabelled(tree, '✕');
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

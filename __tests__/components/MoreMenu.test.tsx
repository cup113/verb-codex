import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { MoreButton, MoreMenu } from '../../src/components/MoreMenu';
import { copy } from '../../src/copy';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

function render(
  element: React.ReactElement,
): ReactTestRenderer.ReactTestRenderer {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return rendered;
}

/**
 * Press whatever `label` sits in.
 *
 * `Pressable` is memo-wrapped, so it has no type a test can match; climbing
 * from the label to the nearest ancestor that carries `onPress` is stable
 * regardless of how many wrappers React Native puts in between.
 */
function pressLabelled(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): void {
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  if (!text) {
    throw new Error(`no menu label ${label}`);
  }
  let node = text.parent;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`menu label ${label} has no pressable above it`);
  }
  ReactTestRenderer.act(() => {
    node!.props.onPress();
  });
}

describe('MoreButton', () => {
  it('tells a screen reader whether its menu is open', () => {
    const closed = render(<MoreButton expanded={false} onPress={() => {}} />);
    const open = render(<MoreButton expanded onPress={() => {}} />);

    // Read off whichever node carries it, as in VerbRow.test: Pressable is
    // memo-wrapped and has no type to match on.
    const expandedOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
      tree.root.findAll(
        node => node.props?.accessibilityLabel === copy.more,
      )[0].props['aria-expanded'];

    expect(expandedOf(closed)).toBe(false);
    expect(expandedOf(open)).toBe(true);
  });
});

describe('MoreMenu', () => {
  const items = [{ label: copy.backupLink, onPress: () => {} }];

  it('draws nothing at all while it is closed', () => {
    const tree = render(
      <MoreMenu visible={false} top={58} onDismiss={() => {}} items={items} />,
    );

    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('lists its items while it is open', () => {
    const tree = render(
      <MoreMenu visible top={58} onDismiss={() => {}} items={items} />,
    );

    expect(tree.root.findAllByType(Text).map(node => node.props.children)).toEqual(
      [copy.backupLink],
    );
  });

  it('dismisses before it acts, so the menu never outlives its own choice', () => {
    const calls: string[] = [];
    const tree = render(
      <MoreMenu
        visible
        top={58}
        onDismiss={() => calls.push('dismiss')}
        items={[{ label: copy.backupLink, onPress: () => calls.push('act') }]}
      />,
    );

    pressLabelled(tree, copy.backupLink);

    expect(calls).toEqual(['dismiss', 'act']);
  });

  it('closes when the tap lands anywhere else', () => {
    const onDismiss = jest.fn();
    const tree = render(
      <MoreMenu visible top={58} onDismiss={onDismiss} items={items} />,
    );

    // The backdrop is the first pressable in the menu: it is drawn first and
    // everything else sits on top of it.
    const backdrop = tree.root.findAll(
      node => typeof node.props?.onPress === 'function',
    )[0];
    ReactTestRenderer.act(() => {
      backdrop.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { MARK_TEST_ID, VerbRow } from '../../src/components/VerbRow';
import { PICK_UP_HOLD_MS, STAR_HOLD_MS, STAR_HOLD_SLOP } from '../../src/components/holds';
import { emptyRows } from '../../src/domain/verbs';
import { copy } from '../../src/copy';
import { colors, fonts } from '../../src/theme';
import { Verb } from '../../src/types';

const SIX = ['aime', 'aimes', 'aime', 'aimons', 'aimez', 'aiment'];

function makeVerb(forms: readonly string[], starred = false): Verb {
  return {
    id: 'v1',
    infinitive: 'aimer',
    group: 1,
    tense: 'present',
    rows: emptyRows().map((row, index) =>
      forms[index] === undefined ? row : { form: forms[index] },
    ),
    note: '',
    starred,
    createdAt: 0,
    updatedAt: 0,
  };
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
const noop = () => {};

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

function render(
  verb: Verb,
  props: Partial<React.ComponentProps<typeof VerbRow>> = {},
): ReactTestRenderer.ReactTestRenderer {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <VerbRow verb={verb} onPress={noop} {...props} />,
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

/** The single ★ in the tree, or undefined when the mark is a tick or a ring. */
function starNode(
  tree: ReactTestRenderer.ReactTestRenderer,
): ReactTestRenderer.ReactTestInstance | undefined {
  return tree.root
    .findAllByType(Text)
    .find(node => node.props.children === '★');
}

/** The mark's own press target: the row has two pressables now. */
function mark(
  tree: ReactTestRenderer.ReactTestRenderer,
): ReactTestRenderer.ReactTestInstance {
  return tree.root.findAllByProps({ testID: MARK_TEST_ID })[0];
}

describe('VerbRow', () => {
  it('draws the tick only once all six rows are written', () => {
    expect(drawsTick(render(makeVerb(SIX)))).toBe(true);
    expect(drawsTick(render(makeVerb(['aime', 'aimes'])))).toBe(false);
    // Whitespace is not a recorded word, so it does not close the sixth row.
    expect(drawsTick(render(makeVerb([...SIX.slice(0, 5), '   '])))).toBe(
      false,
    );
  });

  it('draws the star only on a complete entry that carries one', () => {
    const starred = render(makeVerb(SIX, true));
    expect(starNode(starred)).toBeDefined();
    // The star takes the tick's place; it never sits beside it.
    expect(drawsTick(starred)).toBe(false);

    // A star kept on an entry that lost a row is not drawn: completeness is
    // the stronger fact, and the list must never hide an open entry.
    const reopened = render(makeVerb(['aime', 'aimes'], true));
    expect(starNode(reopened)).toBeUndefined();
    expect(drawsTick(reopened)).toBe(false);

    expect(starNode(render(makeVerb(SIX)))).toBeUndefined();
  });

  it('writes the star in the same diluted accent as the tick', () => {
    // A recorded mark, not a badge: the symbol face carries the shape, the
    // palette stays the notebook's one accent diluted into paper.
    const style = StyleSheet.flatten(
      starNode(render(makeVerb(SIX, true)))!.props.style,
    );
    expect(style.color).toBe(colors.terracottaSoft);
    expect(style.fontFamily).toBe(fonts.symbol);
    expect(colors.terracottaSoft).not.toBe(colors.terracotta);
  });

  it('writes the star after its hold on the mark, and only on a complete entry', () => {
    jest.useFakeTimers();
    try {
      const onToggleStar = jest.fn();
      const complete = mark(render(makeVerb(SIX), { onToggleStar }));
      ReactTestRenderer.act(() => {
        complete.props.onPressIn({ nativeEvent: { pageX: 0, pageY: 0 } });
        jest.advanceTimersByTime(STAR_HOLD_MS - 1);
      });
      expect(onToggleStar).not.toHaveBeenCalled();
      ReactTestRenderer.act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onToggleStar).toHaveBeenCalledTimes(1);

      // The ring is not a control: there is no complete entry to set aside yet.
      const onOpenStar = jest.fn();
      const open = mark(
        render(makeVerb(['aime']), { onToggleStar: onOpenStar }),
      );
      expect(open.props.onLongPress).toBeUndefined();
      ReactTestRenderer.act(() => {
        open.props.onPressIn({ nativeEvent: { pageX: 0, pageY: 0 } });
        jest.advanceTimersByTime(STAR_HOLD_MS * 2);
      });
      expect(onOpenStar).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('forgives a little drift and refuses a lot', () => {
    // The platform's own long press dies at 10pt, which is why the mark runs
    // its own clock; this is the margin that clock allows.
    jest.useFakeTimers();
    try {
      const forgiving = jest.fn();
      const held = mark(render(makeVerb(SIX), { onToggleStar: forgiving }));
      ReactTestRenderer.act(() => {
        held.props.onPressIn({ nativeEvent: { pageX: 0, pageY: 0 } });
        held.props.onPressMove({
          nativeEvent: { pageX: 0, pageY: STAR_HOLD_SLOP - 1 },
        });
        jest.advanceTimersByTime(STAR_HOLD_MS);
      });
      expect(forgiving).toHaveBeenCalledTimes(1);

      const slipped = jest.fn();
      const slippedMark = mark(
        render(makeVerb(SIX), { onToggleStar: slipped }),
      );
      ReactTestRenderer.act(() => {
        slippedMark.props.onPressIn({ nativeEvent: { pageX: 0, pageY: 0 } });
        slippedMark.props.onPressMove({
          nativeEvent: { pageX: 0, pageY: STAR_HOLD_SLOP + 1 },
        });
        jest.advanceTimersByTime(STAR_HOLD_MS);
      });
      expect(slipped).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('swallows the release after a star or a slip, and keeps the tap', () => {
    jest.useFakeTimers();
    try {
      const onPress = jest.fn();
      const onToggleStar = jest.fn();
      const tree = render(makeVerb(SIX), { onPress, onToggleStar });
      ReactTestRenderer.act(() => {
        mark(tree).props.onPressIn({ nativeEvent: { pageX: 0, pageY: 0 } });
        jest.advanceTimersByTime(STAR_HOLD_MS);
        mark(tree).props.onPressOut();
        mark(tree).props.onPress();
      });
      expect(onToggleStar).toHaveBeenCalledTimes(1);
      // The built-in long press cancels without cancelling the press, so the
      // release would otherwise open the entry right after starring it.
      expect(onPress).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('tells the list when the hold starts and ends, so it can stop scrolling', () => {
    jest.useFakeTimers();
    try {
      const onStarHoldStart = jest.fn();
      const onStarHoldEnd = jest.fn();
      const tree = render(makeVerb(SIX), { onStarHoldStart, onStarHoldEnd });
      ReactTestRenderer.act(() => {
        mark(tree).props.onPressIn({ nativeEvent: { pageX: 0, pageY: 0 } });
        mark(tree).props.onPressOut();
      });
      expect(onStarHoldStart).toHaveBeenCalledTimes(1);
      expect(onStarHoldEnd).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('still opens the entry when the mark is tapped', () => {
    const onPress = jest.fn();
    const tree = render(makeVerb(SIX), { onPress });
    ReactTestRenderer.act(() => {
      mark(tree).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('waits the pick-up hold on the row and the star hold on the mark', () => {
    // Two holds, one row: the words are the drag handle, the mark is not. A
    // literal here would go stale silently, so both numbers are read from the
    // module that states them.
    const tree = render(makeVerb(SIX));
    expect(mark(tree).props.delayLongPress).toBe(STAR_HOLD_MS);
    const rowDelays = tree.root
      .findAll(node => node.props?.delayLongPress !== undefined)
      .map(node => node.props.delayLongPress);
    expect(rowDelays).toContain(PICK_UP_HOLD_MS);
  });

  it('wraps the words, not the mark, in the drag gesture', () => {
    // This is the whole gesture partition: if the mark sat inside the drag
    // wrapper, the native handler would cancel the star hold at 400ms.
    const tree = render(makeVerb(SIX), {
      wrapDrag: node => <View testID="drag-wrap">{node}</View>,
    });
    const wrapper = tree.root.findByProps({ testID: 'drag-wrap' });
    expect(wrapper.findAllByType(Text).length).toBeGreaterThan(0);
    expect(wrapper.findAllByProps({ testID: MARK_TEST_ID })).toHaveLength(0);
  });

  it('says how much is on paper, now that the mark is drawn rather than written', () => {
    // Read off whichever node carries it: `Pressable` is memo-wrapped, so it
    // has no type a test can match — the prop itself is the stable handle.
    const label = (tree: ReactTestRenderer.ReactTestRenderer): string =>
      tree.root.findAll(node => node.props?.accessibilityLabel !== undefined)[0]
        .props.accessibilityLabel;

    expect(label(render(makeVerb(SIX)))).toBe('aimer, 6 lignes sur 6');
    expect(label(render(makeVerb(['aime', 'aimes'])))).toBe(
      'aimer, 2 lignes sur 6',
    );
  });

  it('offers the star to a screen reader as an action on the row', () => {
    // iOS and Android fold the nested mark into the row, so the row carries
    // the action; the label changes with the state it would write.
    const onToggleStar = jest.fn();
    const tree = render(makeVerb(SIX), { onToggleStar });
    const row = tree.root.findAll(
      node => node.props?.accessibilityActions !== undefined,
    )[0];
    expect(row.props.accessibilityActions).toEqual([
      { name: 'star', label: copy.star },
    ]);

    ReactTestRenderer.act(() => {
      row.props.onAccessibilityAction({ nativeEvent: { actionName: 'star' } });
    });
    expect(onToggleStar).toHaveBeenCalledTimes(1);

    const starred = render(makeVerb(SIX, true), { onToggleStar });
    const starredRow = starred.root.findAll(
      node => node.props?.accessibilityActions !== undefined,
    )[0];
    expect(starredRow.props.accessibilityActions).toEqual([
      { name: 'star', label: copy.unstar },
    ]);
  });
});

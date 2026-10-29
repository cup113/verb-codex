import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { VerdictStamp } from '../../src/components/VerdictStamp';
import { copy } from '../../src/copy';
import { colors, fonts } from '../../src/theme';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  // The stamp carries a spring with a delay; leaving it mounted would let a
  // frame land in a torn-down environment.
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

function render(tier: 'flawless' | 'corrected') {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<VerdictStamp tier={tier} delay={0} />);
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return rendered;
}

/** The colour the stamp's own words are written in. */
function labelColor(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): unknown {
  const node = tree.root
    .findAllByType(Text)
    .find(text => text.props.children === label);
  if (!node) {
    throw new Error(`no stamp text ${label}`);
  }
  return StyleSheet.flatten(node.props.style)?.color;
}

/** Every rule the stamp draws, in tree order. */
function ruleColors(
  tree: ReactTestRenderer.ReactTestRenderer,
): (string | undefined)[] {
  return tree.root
    .findAll(node => node.props.style !== undefined)
    .map(node => StyleSheet.flatten(node.props.style)?.borderColor)
    .filter((color): color is string => typeof color === 'string');
}

describe('VerdictStamp', () => {
  it('presses a flawless paper in the verdict ink, rings and words alike', () => {
    const tree = render('flawless');

    expect(labelColor(tree, copy.stampFlawless)).toBe(colors.verdictRight);
    // Both rings: the right verdict is written all the way through. React
    // Native reports each style on the wrapper and on its host view, so the
    // hue set is what is asserted rather than a node count.
    expect(new Set(ruleColors(tree))).toEqual(new Set([colors.verdictRight]));
  });

  it('signs a corrected paper with the correction pen, not the verdict ink', () => {
    const tree = render('corrected');

    expect(labelColor(tree, copy.stampCorrected)).toBe(colors.terracotta);
    expect(new Set(ruleColors(tree))).toEqual(new Set([colors.terracotta]));
  });

  it('sets the ornaments from the symbol face, not a borrowed system glyph', () => {
    // The stamp's ✦ and the list's ★ come from the same four-codepoint face;
    // before this, ✦ was whatever symbol glyph the device happened to own.
    const ornaments = render('flawless')
      .root.findAllByType(Text)
      .filter(node => node.props.children === copy.stampOrnament);

    expect(ornaments).toHaveLength(2);
    ornaments.forEach(node => {
      const style = StyleSheet.flatten(node.props.style);
      expect(style.fontFamily).toBe(fonts.symbol);
      expect(style.color).toBe(colors.verdictRight);
    });
    // The corrected remark carries no ornament at all.
    expect(
      render('corrected')
        .root.findAllByType(Text)
        .filter(node => node.props.children === copy.stampOrnament),
    ).toHaveLength(0);
  });

  it('keeps the two tiers distinguishable by colour as well as by shape', () => {
    // The tiers are already told apart by the double ring; the inks must not
    // collapse onto one value, or the two marks would differ only in size.
    const flawless = ruleColors(render('flawless'));
    const corrected = ruleColors(render('corrected'));

    expect(flawless[0]).not.toBe(corrected[0]);
    expect(colors.verdictRight).not.toBe(colors.terracotta);
  });
});

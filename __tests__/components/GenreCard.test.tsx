import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { GenreCard } from '../../src/components/GenreCard';
import { copy } from '../../src/copy';
import { colors } from '../../src/theme';
import type { AnswerOutcome, Box, Gender } from '../../src/domain/genre';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

type CardProps = React.ComponentProps<typeof GenreCard>;

function render(props: Partial<CardProps> = {}) {
  const onPick = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <GenreCard
        word="temps"
        gloss="时间；天气"
        gender="m"
        picked={null}
        outcome={null}
        onPick={onPick}
        {...props}
      />,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return { tree: rendered, onPick };
}

/** The text a node puts on paper, including any nested `Text` runs. */
function textOf(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join('');
}

/** Every string the card puts on paper, one entry per `Text` node. */
function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(node => textOf(node));
}

function styleOf(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const node = tree.root.findAllByType(Text).find(text => text.props.children === label);
  if (!node) {
    throw new Error(`no text ${label}`);
  }
  return StyleSheet.flatten(node.props.style) as Record<string, unknown>;
}

/** Press whatever the article sits in, as a touch would. */
function pressArticle(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  if (!text) {
    throw new Error(`no article ${label}`);
  }
  let node = text.parent;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`article ${label} has no pressable above it`);
  }
  ReactTestRenderer.act(() => {
    node!.props.onPress();
  });
}

const advanced = (box: Box): AnswerOutcome => ({ kind: 'advanced', box });

describe('GenreCard', () => {
  it('asks for the article with the word and its gloss already visible', () => {
    const { tree } = render();

    const written = texts(tree);
    expect(written).toContain('temps');
    expect(written).toContain('时间；天气');
    expect(written).toContain(copy.genrePrompt);
    expect(written).toEqual(expect.arrayContaining(['le', 'la']));
  });

  it('hands the chosen article up instead of answering itself', () => {
    const { tree, onPick } = render();

    pressArticle(tree, 'la');

    expect(onPick).toHaveBeenCalledWith('f');
  });

  it('reveals the article that was right, and says what a review box did', () => {
    const { tree } = render({ picked: 'm', outcome: advanced(2) });

    const written = texts(tree);
    expect(written).toContain('le temps');
    expect(written).toContain(copy.genreBoxDue(2, copy.genreDueIn(1)));
    expect(written).not.toContain(copy.genrePrompt);
  });

  it('says nothing under a right practice answer but the answer itself', () => {
    const { tree } = render({ picked: 'm' });

    expect(texts(tree)).toContain('le temps');
    // No box line: a right practice answer moved nothing.
    expect(texts(tree).some(text => text.startsWith('Boîte'))).toBe(false);
  });

  it('strikes the article that was wrong and inks the right one', () => {
    const { tree } = render({ picked: 'f' });

    expect(styleOf(tree, 'la').textDecorationLine).toBe('line-through');
    expect(styleOf(tree, 'le').color).toBe(colors.terracotta);
  });

  it('marks a review question with its box', () => {
    const { tree } = render({ reviewBox: 3 });

    const written = texts(tree);
    expect(written).toContain(copy.genreKind);
    expect(written).toContain(copy.genreBoxTag(3));
  });

  it('draws no box tag in a practice sitting', () => {
    const { tree } = render();

    expect(texts(tree)).not.toContain(copy.genreKind);
  });

  it('announces the reveal to a screen reader', () => {
    const { tree } = render();

    const region = tree.root.findAll(
      node => node.props?.accessibilityLiveRegion === 'polite',
    );

    // The prop lands on both the wrapper and its host view; one live region is
    // what matters, and two nodes carrying it is how React Native spells it.
    expect(region.length).toBeGreaterThan(0);
  });

  it('shows a word the bank has no gloss for without an empty line', () => {
    const { tree } = render({ gloss: '' });

    expect(texts(tree)).toEqual(['temps', 'le', 'la', copy.genrePrompt]);
  });

  it('accepts both genders without assuming one', () => {
    const feminine = render({ word: 'vie', gender: 'f' as Gender, picked: 'f' });

    expect(texts(feminine.tree)).toContain('la vie');
  });
});

import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { ROW_COUNT, Verb } from '../types';
import { PICK_UP_HOLD_MS, STAR_HOLD_MS, STAR_HOLD_SLOP } from './holds';
import { filledCount, isComplete } from '../domain/verbs';
import { copy } from '../copy';
import { cardSurface, colors, fonts, mono, serif } from '../theme';

/**
 * The mark's own touch target, named for the web twin: a pointer that starts
 * on it must not arm the row's drag, or the browser would pick the row up at
 * 400ms and the star would never mature. See VerbList.web.
 */
export const MARK_TEST_ID = 'verb-mark';

/** The long press is kept only for its side effects; see the mark below. */
const swallowed = () => {};

/** A press event's page point, whichever platform's shape it arrives in. */
function touchPage(event: GestureResponderEvent): { x: number; y: number } {
  const touch = event.nativeEvent.changedTouches?.[0] ?? event.nativeEvent;
  return { x: touch.pageX, y: touch.pageY };
}

type Props = {
  verb: Verb;
  onPress: () => void;
  /**
   * Why this entry is on the list, when the headword does not say it — a search
   * that matched one of the six whole words. Absent the rest of the time, so a
   * row is one line unless there is something to explain.
   */
  hint?: string;
  /**
   * A long press on the row. The native list passes an empty function on
   * purpose: picking the row up is the gesture-handler long press the list
   * wraps around it (`DraggableRow` in VerbList.tsx), and setting a long-press
   * handler is the only way to stop React Native from also firing `onPress` on
   * release — which would open the entry after a row was picked up and put
   * back. Absent on the web, where a mouse drag does the reordering.
   */
  onLongPress?: () => void;
  /**
   * A long press on the mark, once the entry is complete: writes or unwrites
   * the owner's star. Not offered on an incomplete entry — the ring is not a
   * control, and there is nothing yet to set aside.
   */
  onToggleStar?: () => void;
  /**
   * Called when the mark's hold starts and ends. The list turns its scrolling
   * off for the length of the hold: a ScrollView claims a touch after ~8pt of
   * travel and would cancel the press before two seconds had passed.
   */
  onStarHoldStart?: () => void;
  onStarHoldEnd?: () => void;
  /**
   * Wraps the one part of the row that may be picked up and dragged: the
   * headword and its hint. The native list supplies its gesture detector here;
   * the mark has to stay outside it, because an active native handler cancels
   * the pressable's long-press timer at `PICK_UP_HOLD_MS`. The web twin has no
   * gesture to wrap and leaves this out.
   */
  wrapDrag?: (content: ReactElement) => ReactElement;
  /** True while this row is lifted, on either platform's terms. */
  dragging?: boolean;
};

export function VerbRow({
  verb,
  onPress,
  hint,
  onLongPress,
  onToggleStar,
  wrapDrag,
  dragging = false,
  onStarHoldStart,
  onStarHoldEnd,
}: Props) {
  const filled = filledCount(verb);
  const complete = isComplete(verb);

  // The star's own two-second clock, kept here rather than in `onLongPress`:
  // both React Native and React Native Web cancel a built-in long press once
  // the touch travels 10pt, and two seconds of holding moves further than that
  // (see STAR_HOLD_SLOP in holds.ts). These refs hold the press's origin, how
  // far it has drifted, and whether the star has already been written.
  const starTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starOrigin = useRef<{ x: number; y: number } | null>(null);
  const starFired = useRef(false);
  const starMoved = useRef(false);
  const starHolding = useRef(false);

  const clearStarTimer = useCallback(() => {
    if (starTimer.current !== null) {
      clearTimeout(starTimer.current);
      starTimer.current = null;
    }
  }, []);

  useEffect(() => clearStarTimer, [clearStarTimer]);

  const beginStarHold = (event: GestureResponderEvent) => {
    starFired.current = false;
    starMoved.current = false;
    starOrigin.current = touchPage(event);
    clearStarTimer();
    if (!complete) {
      return;
    }
    // The list stops scrolling while this is held: a ScrollView would claim
    // the touch after ~8pt and cancel the press, which is the same failure the
    // 30pt allowance exists to avoid.
    starHolding.current = true;
    onStarHoldStart?.();
    starTimer.current = setTimeout(() => {
      starTimer.current = null;
      starFired.current = true;
      onToggleStar?.();
    }, STAR_HOLD_MS);
  };

  const moveStarHold = (event: GestureResponderEvent) => {
    const at = touchPage(event);
    if (starOrigin.current === null) {
      return;
    }
    const drift = Math.hypot(
      at.x - starOrigin.current.x,
      at.y - starOrigin.current.y,
    );
    if (drift > STAR_HOLD_SLOP) {
      starMoved.current = true;
      clearStarTimer();
    }
  };

  const endStarHold = () => {
    clearStarTimer();
    starOrigin.current = null;
    if (starHolding.current) {
      starHolding.current = false;
      onStarHoldEnd?.();
    }
  };

  /**
   * The mark's press: open the entry on a tap, swallow the release after a
   * hold. `onLongPress` cannot do this because the platform cancels it on a
   * small drift while still delivering the press on release — the star would
   * be written and the entry opened at once.
   */
  const pressStar = () => {
    const wrote = starFired.current;
    const drifted = starMoved.current;
    starFired.current = false;
    starMoved.current = false;
    if (wrote || drifted) {
      return;
    }
    onPress();
  };

  const words = (
    <View style={styles.words}>
      <Text style={styles.infinitive} numberOfLines={1}>
        {verb.infinitive}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={PICK_UP_HOLD_MS}
      // The six rows are shown as a mark, not as text, so the count they stand
      // for has to be said out loud here or it would be lost to a reader. The
      // star rides along as the row's selected state, and is reachable as an
      // action because a nested button is folded into this one on iOS and
      // Android (see the mark below).
      accessibilityLabel={`${verb.infinitive}, ${copy.rowsRecorded(
        filled,
        ROW_COUNT,
      )}`}
      // "Selected" is what the mark shows, not what the file holds: a star
      // kept on an entry that lost a row is deliberately invisible, and a
      // reader must not hear a state neither they nor the list can act on.
      accessibilityState={{ selected: complete && verb.starred }}
      accessibilityActions={
        complete
          ? [{ name: 'star', label: verb.starred ? copy.unstar : copy.star }]
          : undefined
      }
      onAccessibilityAction={event => {
        if (complete && event.nativeEvent.actionName === 'star') {
          onToggleStar?.();
        }
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        dragging && styles.dragging,
      ]}
    >
      {wrapDrag ? wrapDrag(words) : words}
      {/* A filled codex is what this whole screen is for, so the state is drawn
          the way a checked-off line in a notebook is: a tick, in the accent
          diluted to a lighter brown — a mark is a record the paper holds, not a
          call to action. The star is the owner's own pencil in that margin: it
          only exists once the tick does, and it is written or rubbed out by
          holding the mark. */}
      <Pressable
        testID={MARK_TEST_ID}
        onPress={pressStar}
        onPressIn={beginStarHold}
        onPressMove={moveStarHold}
        onPressOut={endStarHold}
        // Not the star itself: this long press is cancelled by 10pt of drift,
        // so `onPressIn` + the mark's own timer is what writes the star. The
        // handler stays for its side effects — React Native Web only suppresses
        // the touch context menu when one is present, and on native it keeps
        // the star-hold release from also arriving as a press.
        onLongPress={complete ? swallowed : undefined}
        delayLongPress={STAR_HOLD_MS}
        // About 45pt tall on the phone with the reach above and below; the
        // 44pt width is the zone itself. The web build has no hitSlop, so
        // there it is 44x18 — enough for a mouse.
        hitSlop={{ top: 12, bottom: 12 }}
        // One accessible element is the row: iOS and Android group a nested
        // control away, so the star is offered there as the row's action. The
        // web has no such grouping and exposes this button for what it is.
        accessibilityRole={complete ? 'button' : undefined}
        accessibilityLabel={
          complete ? (verb.starred ? copy.unstar : copy.star) : undefined
        }
        accessibilityHint={complete ? copy.starHint : undefined}
        style={({ pressed }) => [
          styles.markZone,
          pressed && styles.markPressed,
        ]}
      >
        <View style={styles.mark}>
          {complete ? (
            verb.starred ? (
              <Text style={styles.star} allowFontScaling={false}>
                ★
              </Text>
            ) : (
              <View style={styles.tick} />
            )
          ) : (
            <View style={styles.openRow} />
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...cardSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.75,
  },
  // Lifted off the paper while held: the row that is being dragged has to be
  // unmistakably the one under the finger.
  dragging: {
    elevation: 8,
    borderColor: colors.terracotta,
  },
  // The headword and its hint share the slack, so the mark and the chevron
  // stay put whether or not the row has something to explain.
  words: {
    flex: 1,
  },
  infinitive: {
    ...serif(22),
  },
  hint: {
    ...mono(11),
    marginTop: 2,
  },
  /*
   * The mark's touch target, not its drawing: 44pt wide, with the mark and the
   * chevron flush to its right edge. The extra width is taken from the words
   * (which are the only flexible child), so nothing in the row moves except
   * the end of the headword's column. Its height is the line it sits on;
   * `hitSlop` above and below brings the target to roughly 44x45 on the phone
   * while staying inside the card. The web has no hitSlop, so there it is 44
   * wide and one line tall — enough for a mouse.
   */
  markZone: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // The hold and the tap both need to show they landed; a long hold with no
  // feedback reads as a broken press.
  markPressed: {
    opacity: 0.45,
  },
  /*
   * The column of marks is nudged as one, so the tick, the star and the ring
   * keep a single centre between them:
   *
   * * down 1.5, onto the row's chevron rather than its middle. Measured on the
   *   web build, the tick's ink centre sat 0.4pt above the ›'s, and it still
   *   read high — a check's mass lies in its long upstroke — so the tick lands
   *   a hair below the ›'s centre, which is where a hand-drawn one sits.
   * * in 1.5, so the tick does not crowd the › it has to be read against; the
   *   chevron's own 8pt margin is what is left of that gap.
   *
   * Both are relative offsets, so neither moves the chevron nor the row.
   */
  mark: {
    width: 18,
    height: 18,
    top: 1.5,
    left: -1.5,
  },
  /*
   * The tick is two borders of one box, turned 45° — drawn rather than typed,
   * because a ✓ is a font's opinion and both faces here are Latin or hanzi.
   *
   * The placement is arithmetic, not taste: a 7x12 box rotated about its
   * centre has its ink spanning y -1.8..6.7, i.e. ~2.5 below the box's own
   * centre, so the box is parked 2.5 above the middle of its 18pt slot and the
   * ink lands on that middle — which is where the › beside it sits. The
   * column's own 1.5pt nudge is then what tips the tick a hair past the ›, as a
   * hand-drawn one is.
   */
  tick: {
    position: 'absolute',
    left: 5.5,
    top: 0.5,
    width: 7,
    height: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.terracottaSoft,
    transform: [{ rotate: '45deg' }],
  },
  /*
   * The star is a typed symbol, not a drawn shape: five points cannot be built
   * out of borders the way the tick can. It comes from `NewsreaderSymbols`
   * (tools/make-symbols.py), not the merged hanzi face — ★ lives in that
   * face's `unicode-range` and one star must not cost a browser 3.5 MB.
   *
   * Same ink as the tick: the shape carries the meaning, and the codex has one
   * accent and one dilution of it. The 18pt line box matches the slot the tick
   * is laid out in; the small `top` below is what puts the glyph's ink centre
   * on the tick's, rather than on the line box's.
   */
  star: {
    fontFamily: fonts.symbol,
    fontSize: 15,
    lineHeight: 18,
    color: colors.terracottaSoft,
    textAlign: 'center',
    includeFontPadding: false,
    // Measured on the web build: the symbol's ink centre lands 1pt above the
    // tick's in the same slot (a star's mass sits above the baseline). Nudged
    // down onto the column the tick and the › share.
    top: 2,
  },
  /** Still open: a ring, thinner and quieter than the tick it is waiting for. */
  openRow: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.inkSecondary,
    opacity: 0.5,
  },
  chevron: {
    ...serif(18, { color: colors.line }),
    marginLeft: 8,
  },
});

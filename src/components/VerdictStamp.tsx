import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, serif } from '../theme';
import { copy } from '../copy';

/** Which of the two papers the user turned in. */
export type StampTier = 'flawless' | 'corrected';

type Props = {
  tier: StampTier;
  /** When the stamp lands; the rows' settle takes a little longer than it. */
  delay?: number;
};

/**
 * The mark a checked paper earns, pressed on the way a rubber stamp is: it
 * arrives too big, overshoots a little, and rests tilted. A flawless paper gets
 * the whole stamp in the verdict ink, a corrected one the smaller remark in the
 * correction pen — the reward says how the paper was earned, not just that it
 * is finished. The corrected tier stays terracotta on purpose: it is the pen
 * signing a paper it had to correct, not a fault left on it.
 */
export function VerdictStamp({ tier, delay = 0 }: Props) {
  const press = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(press, {
      toValue: 1,
      delay,
      friction: 6,
      tension: 90,
      // Same reason as the rows' settle: one stamp, on a card already on
      // screen, and the test renderer has no animated module to hand a view to.
      useNativeDriver: false,
    }).start();
  }, [press, delay]);

  const stampStyle = useMemo(
    () => ({
      opacity: press.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0, 1, 1],
        extrapolate: 'clamp' as const,
      }),
      transform: [
        {
          scale: press.interpolate({
            inputRange: [0, 1],
            outputRange: [1.7, 1],
            extrapolate: 'clamp' as const,
          }),
        },
        {
          rotate: press.interpolate({
            inputRange: [0, 1],
            outputRange: ['-9deg', '-3deg'],
            extrapolate: 'clamp' as const,
          }),
        },
      ],
    }),
    [press],
  );

  const flawless = tier === 'flawless';

  return (
    <Animated.View style={stampStyle}>
      <View style={flawless ? styles.ringOuter : styles.ringThin}>
        {/* The flawless stamp carries a second, inner rule — the double ring of
            a rubber stamp; the corrected remark is a single line. */}
        <View style={flawless ? styles.ringInner : styles.ringNone}>
          {/* The ornament is a symbol, the words are the codex's italic: two
              faces in one line, which is why this is three Texts and not one
              string. Both marks come from NewsreaderSymbols — the same face as
              the list's star — so the stamp no longer borrows a four-point
              star from whichever system font the device happens to own. */}
          <View style={styles.line}>
            {flawless ? (
              <Text style={styles.ornament}>{copy.stampOrnament}</Text>
            ) : null}
            <Text style={flawless ? styles.textFlawless : styles.textCorrected}>
              {flawless ? copy.stampFlawless : copy.stampCorrected}
            </Text>
            {flawless ? (
              <Text style={styles.ornament}>{copy.stampOrnament}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ringOuter: {
    borderWidth: 2,
    borderColor: colors.verdictRight,
    borderRadius: 6,
    padding: 3,
  },
  ringInner: {
    borderWidth: 1,
    borderColor: colors.verdictRight,
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  // The corrected remark is the same family, one weight down: a thin rule and
  // no inner ring, so the two marks are never mistaken for each other.
  ringThin: {
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  ringNone: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  /** The stamp's one line: ornament, words, ornament. */
  line: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ornament: {
    fontFamily: fonts.symbol,
    fontSize: 15,
    lineHeight: 21,
    color: colors.verdictRight,
    // Stands in for the two spaces the old single string carried around its
    // words.
    marginHorizontal: 7,
  },
  textFlawless: {
    ...serif(19, {
      fontFamily: fonts.serifItalic,
      color: colors.verdictRight,
    }),
  },
  textCorrected: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.terracotta }),
  },
});

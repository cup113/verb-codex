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
 * the whole stamp, a corrected one the smaller remark — the reward says how the
 * paper was earned, not just that it is finished.
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
          <Text style={flawless ? styles.textFlawless : styles.textCorrected}>
            {flawless ? copy.stampFlawless : copy.stampCorrected}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ringOuter: {
    borderWidth: 2,
    borderColor: colors.terracotta,
    borderRadius: 6,
    padding: 3,
  },
  ringInner: {
    borderWidth: 1,
    borderColor: colors.terracotta,
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
  textFlawless: {
    ...serif(19, { fontFamily: fonts.serifItalic, color: colors.terracotta }),
  },
  textCorrected: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.terracotta }),
  },
});

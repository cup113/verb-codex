import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  paper: '#F6F2EB',
  card: '#FAF8F5',
  ink: '#2A2421',
  inkSecondary: '#8E8278',
  terracotta: '#B95D38',
  line: '#E6DFD5',
  lineSoft: 'rgba(230, 223, 213, 0.6)',
} as const;

/**
 * Static TTF instances bundled in android/app/src/main/assets/fonts. Android
 * names a family after its file, so each weight is its own family and styles
 * never set fontWeight — that way nothing is silently synthesised.
 */
export const fonts = {
  serif: 'NewsreaderRegular',
  serifMedium: 'NewsreaderMedium',
  serifItalic: 'NewsreaderItalic',
  mono: 'JetBrainsMonoRegular',
  monoMedium: 'JetBrainsMonoMedium',
} as const;

export const serif = (size: number, extra?: TextStyle): TextStyle => ({
  fontFamily: fonts.serif,
  fontSize: size,
  color: colors.ink,
  ...extra,
});

export const mono = (size: number, extra?: TextStyle): TextStyle => ({
  fontFamily: fonts.mono,
  fontSize: size,
  color: colors.inkSecondary,
  ...extra,
});

export const cardSurface: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.lineSoft,
  ...Platform.select({
    android: { elevation: 1 },
    default: {
      shadowColor: colors.ink,
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
  }),
};

import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  paper: '#F6F2EB',
  card: '#FAF8F5',
  ink: '#2A2421',
  inkSecondary: '#8E8278',
  terracotta: '#B95D38',
  /**
   * The accent diluted 48% into the paper: the ink of a recorded mark.
   *
   * A completed entry is a fact the notebook holds, not an invitation to act,
   * so its tick must sit under the accent's weight — 2.1:1 against the card
   * rather than the accent's 4.2:1 — while staying warmer and louder than the
   * ring an open entry draws (1.75:1). One step lighter than the first cut
   * (2.5:1): the tick is a pencil mark in the margin, not a badge.
   */
  terracottaSoft: '#D6A58E',
  /**
   * The two inks a verdict is written in. They are not a second accent: this
   * pair never touches a button or a tab — only the places where the codex says
   * whether a word matched. The accent is not demoted by them; it has always
   * been the correction pen, and now it is named as one.
   *
   * `verdictRight` is the green added for this: 4.95:1 against the card and
   * 4.70:1 against the paper, so a graded page is read at a glance without the
   * warm sheet turning into a traffic light. It is the one ink that must never
   * be reused as decoration — a green tab underline or a green button would
   * make the verdict mean "accent", which is exactly what this change undoes.
   *
   * `verdictWrong` repeats the accent on purpose. The codex has always marked a
   * fault in terracotta — the struck attempt in a dictation, the article not
   * chosen — and a separate red would buy a fourth pigment and no clearer
   * signal. `__tests__/theme.test.ts` holds the pair: distinct from each other,
   * and neither folded back onto the ordinary inks.
   */
  verdictRight: '#2F7A4A',
  verdictWrong: '#B95D38',
  line: '#E6DFD5',
  lineSoft: 'rgba(230, 223, 213, 0.6)',
} as const;

/**
 * Static TTF instances bundled in android/app/src/main/assets/fonts. Android
 * names a family after its file, so each weight is its own family and styles
 * never set fontWeight — that way nothing is silently synthesised.
 *
 * The two serif weights are the merged Latin-and-hanzi faces built by
 * `tools/make-fonts.py`. Android resolves `fontFamily` to a single family, so
 * without the merge a Chinese note inside a Newsreader line would change face
 * mid-sentence. The web has a fallback list, but the second family there is
 * declared behind a `unicode-range` (web/fonts.css), so a browser that renders
 * no hanzi downloads none of that weight.
 */
const serifFamily =
  Platform.OS === 'web'
    ? 'NewsreaderRegular, NewsreaderHanRegular'
    : 'NewsreaderHanRegular';
const serifMediumFamily =
  Platform.OS === 'web'
    ? 'NewsreaderMedium, NewsreaderHanMedium'
    : 'NewsreaderHanMedium';
/**
 * The italic face with the hanzi face behind it: the owner's name is the one
 * italic string a hanzi can reach.
 *
 * The name also asks for `fontStyle: 'italic'`, so a Chinese name slants too:
 * the Latin takes the real italic face, while the hanzi — for which
 * `tools/make-fonts.py` merges an upright face only — is slanted by the
 * browser's synthesis instead of standing upright beside it. Android resolves
 * `fontFamily` to a single family, so it cannot be handed the list; a hanzi in
 * the name there takes the system face, also slanted by synthesis.
 */
const serifItalicFamily =
  Platform.OS === 'web'
    ? 'NewsreaderItalic, NewsreaderHanMedium'
    : 'NewsreaderItalic';

export const fonts = {
  serif: serifFamily,
  serifMedium: serifMediumFamily,
  serifItalic: 'NewsreaderItalic',
  serifItalicHan: serifItalicFamily,
  mono: 'JetBrainsMonoRegular',
  monoMedium: 'JetBrainsMonoMedium',
  /**
   * The two marks that are symbols rather than drawn shapes: the list's ★ and
   * the dictation stamp's ✦. One 6 KB face (tools/make-symbols.py), because
   * ★ in the merged hanzi face would drag its 3.5 MB download into a
   * French-only reader, and the stamp used to borrow a different glyph from
   * every platform's fallback. Same name on both targets: Android resolves a
   * family by file name, the web declares it in web/fonts.css.
   */
  symbol: 'NewsreaderSymbols',
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

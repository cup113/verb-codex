import { colors } from '../src/theme';

/**
 * The verdict inks are the one pair in the palette that carries meaning rather
 * than decoration, so their contrast is asserted here rather than left in a
 * comment: the numbers in `src/theme.ts` are a claim, and this is what keeps it
 * true when someone later reaches for a prettier green.
 */

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const linear = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

describe('the verdict inks', () => {
  it('writes the right verdict at body-text contrast on the card', () => {
    // A settled word is read, not glanced at: the green must clear AA on the
    // card it is written on (measured 4.95:1 when the ink was chosen).
    expect(contrast(colors.verdictRight, colors.card)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('keeps the correction pen at the contrast the accent already had', () => {
    // Terracotta sits at 4.23:1, the ratio the accent has always been used at:
    // a fault mark is a struck word, and the strike carries the small type.
    // Lowering this floor would mean repainting the whole warm sheet.
    expect(contrast(colors.verdictWrong, colors.card)).toBeGreaterThanOrEqual(
      4,
    );
  });

  it('would notice a pastel green slipping past the floor', () => {
    // Without this, a broken `contrast` that returned a large number for any
    // input would satisfy the assertion above. This is the failing case.
    expect(contrast('#9BCE9B', colors.card)).toBeLessThan(4.5);
  });

  it('keeps the two verdicts distinct from each other and from ordinary ink', () => {
    expect(colors.verdictRight).not.toBe(colors.verdictWrong);
    for (const plain of [
      colors.ink,
      colors.inkSecondary,
      colors.terracottaSoft,
    ]) {
      expect(colors.verdictRight).not.toBe(plain);
    }
  });

  it('names the accent as the correction pen on purpose', () => {
    // Deliberate, not an oversight: a fault has always been marked in the
    // accent. Splitting them later means changing this and saying why.
    expect(colors.verdictWrong).toBe(colors.terracotta);
  });
});

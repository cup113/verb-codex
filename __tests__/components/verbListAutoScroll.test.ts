import {
  AUTO_SCROLL_EDGE,
  AUTO_SCROLL_MAX_STEP,
  autoScrollStep,
} from '../../src/components/verbListAutoScroll';

const HEIGHT = 800;

describe('autoScrollStep', () => {
  it('leaves the list alone while the row is in the middle', () => {
    expect(autoScrollStep(HEIGHT / 2, HEIGHT)).toBe(0);
    expect(autoScrollStep(AUTO_SCROLL_EDGE, HEIGHT)).toBe(0);
    expect(autoScrollStep(HEIGHT - AUTO_SCROLL_EDGE, HEIGHT)).toBe(0);
  });

  it('scrolls up near the top and down near the bottom', () => {
    expect(autoScrollStep(10, HEIGHT)).toBeLessThan(0);
    expect(autoScrollStep(HEIGHT - 10, HEIGHT)).toBeGreaterThan(0);
  });

  it('reaches its full step right at the edge, and no further', () => {
    // The row's centre can sit past the edge on its way out; the step must not
    // grow with it, or a drag that overshoots would fling the list.
    expect(autoScrollStep(0, HEIGHT)).toBe(-AUTO_SCROLL_MAX_STEP);
    expect(autoScrollStep(-200, HEIGHT)).toBe(-AUTO_SCROLL_MAX_STEP);
    expect(autoScrollStep(HEIGHT, HEIGHT)).toBe(AUTO_SCROLL_MAX_STEP);
    expect(autoScrollStep(HEIGHT + 200, HEIGHT)).toBe(AUTO_SCROLL_MAX_STEP);
  });

  it('tapers with the distance instead of jumping straight to full speed', () => {
    const quarter = autoScrollStep(AUTO_SCROLL_EDGE / 2, HEIGHT);
    const half = autoScrollStep(AUTO_SCROLL_EDGE / 4, HEIGHT);

    expect(quarter).toBeLessThan(0);
    expect(quarter).toBeGreaterThan(-AUTO_SCROLL_MAX_STEP);
    // Closer to the edge means further, never the other way round.
    expect(half).toBeLessThan(quarter);
    expect(Math.abs(half - quarter)).toBeCloseTo(AUTO_SCROLL_MAX_STEP / 4);
  });
});

import { RESTART_HOLD_DURATION_MS, restartHoldProgress } from './restartHoldMath';

describe('restartHoldProgress', () => {
  it('reports a normalized two-second hold', () => {
    expect(restartHoldProgress(1_000, 1_000)).toBe(0);
    expect(restartHoldProgress(1_000, 2_000)).toBe(0.5);
    expect(restartHoldProgress(1_000, 1_000 + RESTART_HOLD_DURATION_MS)).toBe(1);
  });

  it('clamps early and late timestamps', () => {
    expect(restartHoldProgress(1_000, 500)).toBe(0);
    expect(restartHoldProgress(1_000, 9_000)).toBe(1);
  });
});

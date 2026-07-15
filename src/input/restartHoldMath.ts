export const RESTART_HOLD_DURATION_MS = 2_000;
export const ACTION_HOLD_DURATION_MS = 2_000;

export const holdProgress = (
  startedAtMs: number,
  currentTimeMs: number,
  durationMs = RESTART_HOLD_DURATION_MS,
): number => {
  if (durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, (currentTimeMs - startedAtMs) / durationMs));
};

export const restartHoldProgress = holdProgress;

import type { Direction } from '../game/types';
import type { NormalizedRect } from './renderTypes';

export type { NormalizedRect } from './renderTypes';

export const interpolatedProgress = (
  simulationProgress: number,
  renderLeadSeconds: number,
  durationSeconds: number,
): number => {
  if (durationSeconds <= 0) return 1;
  return Math.max(0, Math.min(1, simulationProgress + renderLeadSeconds / durationSeconds));
};

export const exponentialApproach = (
  current: number,
  target: number,
  responsePerSecond: number,
  deltaSeconds: number,
): number => {
  const response = Math.max(0, responsePerSecond);
  const delta = Math.max(0, deltaSeconds);
  return current + (target - current) * (1 - Math.exp(-response * delta));
};

export const remainingDirtRect = (direction: Direction, progress: number): NormalizedRect => {
  const consumed = Math.max(0, Math.min(1, progress));
  const remaining = 1 - consumed;
  switch (direction) {
    case 'right':
      return { x: consumed, y: 0, width: remaining, height: 1 };
    case 'left':
      return { x: 0, y: 0, width: remaining, height: 1 };
    case 'down':
      return { x: 0, y: consumed, width: 1, height: remaining };
    case 'up':
      return { x: 0, y: 0, width: 1, height: remaining };
  }
};

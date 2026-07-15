import type { Direction } from '../game/types';

const TAU = Math.PI * 2;

export const directionAngle = (direction: Direction): number => {
  switch (direction) {
    case 'right':
      return 0;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'up':
      return -Math.PI / 2;
  }
};

export const shortestAngleDelta = (from: number, to: number): number => {
  let delta = ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (Math.abs(delta + Math.PI) < 0.000001) delta = Math.PI;
  return delta;
};

export const enemyFacingAngle = (
  from: Direction,
  to: Direction,
  progress: number,
): number => {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0) return directionAngle(from);
  if (clamped === 1) return directionAngle(to);
  const eased = clamped * clamped * (3 - 2 * clamped);
  const start = directionAngle(from);
  return start + shortestAngleDelta(start, directionAngle(to)) * eased;
};

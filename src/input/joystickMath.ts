import type { Direction } from '../game/types';
import type { JoystickState } from './inputTypes';

const RELEASE_DEAD_ZONE_FACTOR = 0.72;
const AXIS_SWITCH_RATIO = 1.18;

const isHorizontal = (direction: Direction): boolean =>
  direction === 'left' || direction === 'right';

const stillPointsToward = (direction: Direction, x: number, y: number): boolean => {
  if (direction === 'left') return x < 0;
  if (direction === 'right') return x > 0;
  if (direction === 'up') return y < 0;
  return y > 0;
};

const dominantDirection = (x: number, y: number): Direction => {
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
};

const applyAxisHysteresis = (
  candidate: Direction,
  previous: Direction | null,
  x: number,
  y: number,
): Direction => {
  if (
    previous === null ||
    isHorizontal(candidate) === isHorizontal(previous) ||
    !stillPointsToward(previous, x, y)
  ) {
    return candidate;
  }

  const candidateMagnitude = isHorizontal(candidate) ? Math.abs(x) : Math.abs(y);
  const previousAxisMagnitude = isHorizontal(previous) ? Math.abs(x) : Math.abs(y);
  return candidateMagnitude >= previousAxisMagnitude * AXIS_SWITCH_RATIO
    ? candidate
    : previous;
};

export const calculateJoystickState = (
  deltaX: number,
  deltaY: number,
  maximumRadius: number,
  deadZoneRadius: number,
  previousDirection: Direction | null = null,
): JoystickState => {
  const radius = Math.max(0, maximumRadius);
  const distance = Math.hypot(deltaX, deltaY);
  const scale = distance > radius && distance > 0 ? radius / distance : 1;
  const offsetX = deltaX * scale;
  const offsetY = deltaY * scale;
  const releaseThreshold = Math.max(0, deadZoneRadius) * RELEASE_DEAD_ZONE_FACTOR;
  const threshold = previousDirection === null
    ? Math.max(0, deadZoneRadius)
    : releaseThreshold;

  if (radius === 0 || distance === 0 || distance < threshold) {
    return { direction: null, offsetX, offsetY };
  }

  const candidate = dominantDirection(deltaX, deltaY);
  return {
    direction: applyAxisHysteresis(candidate, previousDirection, deltaX, deltaY),
    offsetX,
    offsetY,
  };
};

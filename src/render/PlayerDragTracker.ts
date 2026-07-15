import { DIRECTION_VECTOR, type Direction } from '../game/types';
import { directionFromDisplacement } from './gestureMath';
import type { ScreenPoint } from './renderTypes';

const MINIMUM_ENGAGE_DISTANCE = 14;
const MAX_STEPS_PER_SAMPLE = 12;
const REVERSE_THRESHOLD_RATIO = 0.75;

const isOppositeDirection = (first: Direction, second: Direction): boolean =>
  (first === 'left' && second === 'right') ||
  (first === 'right' && second === 'left') ||
  (first === 'up' && second === 'down') ||
  (first === 'down' && second === 'up');

/** Converts recent finger motion into discrete steps without joystick-style repeat. */
export class PlayerDragTracker {
  private motionOrigin: ScreenPoint = { x: 0, y: 0 };
  private direction: Direction | null = null;
  private engaged = false;
  private engageDistance = MINIMUM_ENGAGE_DISTANCE;
  private stepStride = 1;

  public constructor(
    private readonly onStep: (direction: Direction) => void,
    private readonly onEnd: () => void,
  ) {}

  public begin(point: ScreenPoint, tileSize: number): void {
    this.end();
    this.motionOrigin = { ...point };
    this.engageDistance = Math.max(MINIMUM_ENGAGE_DISTANCE, tileSize * 0.45);
    this.stepStride = Math.max(1, tileSize);
  }

  public update(point: ScreenPoint): void {
    for (let index = 0; index < MAX_STEPS_PER_SAMPLE; index += 1) {
      const direction = directionFromDisplacement(
        {
          x: point.x - this.motionOrigin.x,
          y: point.y - this.motionOrigin.y,
        },
        this.direction,
        this.engageDistance,
      );
      if (direction === null) return;
      if (
        this.direction !== null &&
        isOppositeDirection(this.direction, direction) &&
        Math.hypot(
          point.x - this.motionOrigin.x,
          point.y - this.motionOrigin.y,
        ) < this.stepStride * REVERSE_THRESHOLD_RATIO
      ) {
        return;
      }

      const vector = DIRECTION_VECTOR[direction];
      this.engaged = true;
      this.direction = direction;
      this.motionOrigin = {
        x: this.motionOrigin.x + vector.x * this.stepStride,
        y: this.motionOrigin.y + vector.y * this.stepStride,
      };
      this.onStep(direction);
    }
  }

  public end(): void {
    const wasEngaged = this.engaged;
    this.engaged = false;
    this.direction = null;
    if (wasEngaged) this.onEnd();
  }

  public get isEngaged(): boolean {
    return this.engaged;
  }
}

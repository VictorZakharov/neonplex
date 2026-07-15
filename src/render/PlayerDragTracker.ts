import { DIRECTION_VECTOR, type Direction } from '../game/types';
import type { ScreenPoint } from './renderTypes';

const MINIMUM_ENGAGE_DISTANCE = 14;
const MAX_STEPS_PER_SAMPLE = 12;
const DISTANCE_EPSILON = 0.001;
const CROSSING_TIME_EPSILON = 0.000_001;
const AXIS_RETURN_DOMINANCE_RATIO = 1.2;

const isHorizontal = (direction: Direction): boolean =>
  direction === 'left' || direction === 'right';

const nearZero = (value: number): number =>
  Math.abs(value) < DISTANCE_EPSILON ? 0 : value;

/** Converts chronological raw finger motion into discrete, backpressured steps. */
export class PlayerDragTracker {
  private rawPoint: ScreenPoint = { x: 0, y: 0 };
  private residual: ScreenPoint = { x: 0, y: 0 };
  private readonly pendingSegments: ScreenPoint[] = [];
  private direction: Direction | null = null;
  private horizontalDirection: Direction | null = null;
  private verticalDirection: Direction | null = null;
  private engaged = false;
  private engageDistance = MINIMUM_ENGAGE_DISTANCE;
  private stepStride = 1;

  public constructor(
    private readonly onStep: (direction: Direction) => boolean,
    private readonly onEnd: () => void,
  ) {}

  public begin(point: ScreenPoint, tileSize: number): void {
    this.end();
    this.configure(tileSize);
    this.rebase(point);
  }

  public configure(tileSize: number): void {
    const normalizedSize = Number.isFinite(tileSize) ? Math.max(1, tileSize) : 1;
    this.engageDistance = Math.max(MINIMUM_ENGAGE_DISTANCE, normalizedSize * 0.45);
    this.stepStride = normalizedSize;
  }

  public rebase(point: ScreenPoint): void {
    this.rawPoint = { ...point };
    this.residual = { x: 0, y: 0 };
    this.pendingSegments.length = 0;
  }

  public update(point: ScreenPoint, tileSize?: number): void {
    if (tileSize !== undefined) this.configure(tileSize);
    const segment = {
      x: point.x - this.rawPoint.x,
      y: point.y - this.rawPoint.y,
    };
    this.rawPoint = { ...point };
    this.enqueueSegment(segment);
    this.drainSegments();
  }

  public end(): void {
    const wasEngaged = this.engaged;
    this.engaged = false;
    this.direction = null;
    this.horizontalDirection = null;
    this.verticalDirection = null;
    this.residual = { x: 0, y: 0 };
    this.pendingSegments.length = 0;
    if (wasEngaged) this.onEnd();
  }

  public get isEngaged(): boolean {
    return this.engaged;
  }

  /** Collapses backpressured samples to the latest pointer position. */
  private enqueueSegment(segment: ScreenPoint): void {
    if (segment.x === 0 && segment.y === 0) return;
    const pending = this.pendingSegments[0];
    if (pending === undefined) {
      this.pendingSegments.push(segment);
      return;
    }
    this.pendingSegments[0] = {
      x: nearZero(pending.x + segment.x),
      y: nearZero(pending.y + segment.y),
    };
  }

  private drainSegments(): void {
    let emittedSteps = 0;
    while (
      this.pendingSegments.length > 0 &&
      emittedSteps < MAX_STEPS_PER_SAMPLE
    ) {
      const segment = this.pendingSegments[0];
      if (segment === undefined) return;
      const crossing = this.nextCrossing(segment);
      if (crossing === null) {
        this.residual = {
          x: nearZero(this.residual.x + segment.x),
          y: nearZero(this.residual.y + segment.y),
        };
        this.pendingSegments.shift();
        continue;
      }

      const [direction, time, threshold] = crossing;
      this.residual = {
        x: nearZero(this.residual.x + segment.x * time),
        y: nearZero(this.residual.y + segment.y * time),
      };
      this.pendingSegments[0] = {
        x: nearZero(segment.x * (1 - time)),
        y: nearZero(segment.y * (1 - time)),
      };

      if (!this.onStep(direction)) return;
      const vector = DIRECTION_VECTOR[direction];
      this.residual = {
        x: nearZero(this.residual.x - vector.x * threshold),
        y: nearZero(this.residual.y - vector.y * threshold),
      };
      this.engaged = true;
      this.direction = direction;
      if (isHorizontal(direction)) {
        this.horizontalDirection = direction;
      } else {
        this.verticalDirection = direction;
      }
      emittedSteps += 1;
    }
  }

  private nextCrossing(
    segment: ScreenPoint,
  ): readonly [Direction, number, number] | null {
    const horizontal = this.axisCrossing(
      this.residual.x,
      segment.x,
      segment,
      'left',
      'right',
    );
    const vertical = this.axisCrossing(
      this.residual.y,
      segment.y,
      segment,
      'up',
      'down',
    );
    if (horizontal === null) return vertical;
    if (vertical === null) return horizontal;
    if (Math.abs(horizontal[1] - vertical[1]) > CROSSING_TIME_EPSILON) {
      return horizontal[1] < vertical[1] ? horizontal : vertical;
    }

    if (this.direction !== null) {
      return isHorizontal(this.direction) ? horizontal : vertical;
    }
    return Math.abs(segment.x) >= Math.abs(segment.y) ? horizontal : vertical;
  }

  private axisCrossing(
    residual: number,
    axisSegment: number,
    segment: ScreenPoint,
    negativeDirection: Direction,
    positiveDirection: Direction,
  ): readonly [Direction, number, number] | null {
    const positiveThreshold = this.thresholdFor(positiveDirection, segment);
    if (residual + DISTANCE_EPSILON >= positiveThreshold) {
      return [positiveDirection, 0, positiveThreshold];
    }
    const negativeThreshold = this.thresholdFor(negativeDirection, segment);
    if (residual - DISTANCE_EPSILON <= -negativeThreshold) {
      return [negativeDirection, 0, negativeThreshold];
    }

    if (axisSegment > DISTANCE_EPSILON) {
      const time = (positiveThreshold - residual) / axisSegment;
      return time <= 1 + CROSSING_TIME_EPSILON
        ? [positiveDirection, Math.max(0, Math.min(1, time)), positiveThreshold]
        : null;
    }
    if (axisSegment < -DISTANCE_EPSILON) {
      const time = (-negativeThreshold - residual) / axisSegment;
      return time <= 1 + CROSSING_TIME_EPSILON
        ? [negativeDirection, Math.max(0, Math.min(1, time)), negativeThreshold]
        : null;
    }
    return null;
  }

  private thresholdFor(direction: Direction, segment: ScreenPoint): number {
    const previousDirection = isHorizontal(direction)
      ? this.horizontalDirection
      : this.verticalDirection;
    if (previousDirection !== direction) return this.engageDistance;
    if (this.direction === direction) return this.stepStride;

    const primary = Math.abs(isHorizontal(direction) ? segment.x : segment.y);
    const secondary = Math.abs(isHorizontal(direction) ? segment.y : segment.x);
    return primary > secondary * AXIS_RETURN_DOMINANCE_RATIO
      ? this.engageDistance
      : this.stepStride;
  }
}

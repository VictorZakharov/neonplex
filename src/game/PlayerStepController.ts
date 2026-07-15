import type { Direction, InputFrame } from './types';
import { PLAYER_STEP_QUEUE_CAPACITY } from './playerStepConfig';

/** Retains a bounded, ordered drag path until the movement cooldown consumes it. */
export class PlayerStepController {
  private readonly pending: Direction[] = [];

  public accept(direction: InputFrame['stepDirection']): boolean {
    if (direction === undefined) return false;
    if (direction === null) {
      this.clear();
      return false;
    }
    if (this.pending.length >= PLAYER_STEP_QUEUE_CAPACITY) return false;
    this.pending.push(direction);
    return true;
  }

  public directionFor(
    heldDirection: Direction | null,
    fallbackDirection: Direction | null,
  ): Direction | null {
    return heldDirection ?? this.pending[0] ?? fallbackDirection;
  }

  public complete(heldDirection: Direction | null): void {
    if (heldDirection === null) this.pending.shift();
  }

  public clear(): void {
    this.pending.length = 0;
  }
}

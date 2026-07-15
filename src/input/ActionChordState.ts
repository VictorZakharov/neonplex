import type { Direction, InputFrame } from '../game/types';
import { ACTION_HOLD_DURATION_MS, holdProgress } from './restartHoldMath';

export class ActionChordState {
  private actionHeld = false;
  private actionQueued = false;
  private excavationQueued: Direction | null = null;
  private actionStartedAt: number | null = null;
  private deploymentCommitted = false;

  public pressAction(heldDirection: Direction | null, currentTimeMs: number): boolean {
    if (this.actionHeld) return false;
    this.actionHeld = true;
    this.actionStartedAt = heldDirection === null ? currentTimeMs : null;
    this.deploymentCommitted = false;
    if (heldDirection !== null) {
      this.excavationQueued = heldDirection;
    }
    return heldDirection === null;
  }

  public pressDirection(direction: Direction): boolean {
    if (!this.actionHeld) return false;
    this.excavationQueued = direction;
    if (!this.deploymentCommitted) this.actionStartedAt = null;
    return true;
  }

  public restartDeploymentHold(currentTimeMs: number): boolean {
    if (!this.actionHeld || this.deploymentCommitted) return false;
    this.actionStartedAt = currentTimeMs;
    return true;
  }

  public releaseAction(): void {
    this.actionHeld = false;
    this.actionStartedAt = null;
    this.deploymentCommitted = false;
  }

  public completeDeploymentHold(): void {
    if (
      !this.actionHeld ||
      this.actionStartedAt === null ||
      this.deploymentCommitted
    ) {
      return;
    }
    this.deploymentCommitted = true;
    this.actionQueued = true;
  }

  public getDeploymentHoldProgress(currentTimeMs: number): number | null {
    if (
      !this.actionHeld ||
      this.deploymentCommitted ||
      this.actionStartedAt === null
    ) {
      return null;
    }
    return holdProgress(this.actionStartedAt, currentTimeMs, ACTION_HOLD_DURATION_MS);
  }

  public consume(heldDirection: Direction | null): InputFrame {
    if (this.actionQueued) {
      this.actionQueued = false;
      return { direction: null, action: true, excavate: null };
    }
    const excavate = this.excavationQueued ?? (this.actionHeld ? heldDirection : null);
    this.excavationQueued = null;
    const direction = this.actionHeld || excavate !== null ? null : heldDirection;
    return { direction, action: false, excavate };
  }

  public clear(): void {
    this.actionHeld = false;
    this.actionQueued = false;
    this.excavationQueued = null;
    this.actionStartedAt = null;
    this.deploymentCommitted = false;
  }
}

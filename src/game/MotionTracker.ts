import type {
  Tile,
  Direction,
  CellConsumption,
  Point,
  TileMotion,
  TileMotionKind,
} from './types';
import { clamp01, COOLDOWN_EPSILON, PLAYER_TWEEN_DURATION } from './gameTiming';
import type { ActiveCellConsumption, ActiveTileMotion } from './internalTypes';

const isSamePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** Tracks render-facing interpolation independently from gameplay state transitions. */
export class MotionTracker {
  private playerElapsed = PLAYER_TWEEN_DURATION;
  private cellConsumptions: ActiveCellConsumption[] = [];
  private tileMotions: ActiveTileMotion[] = [];

  public reset(): void {
    this.playerElapsed = PLAYER_TWEEN_DURATION;
    this.cellConsumptions = [];
    this.tileMotions = [];
  }

  public advance(deltaSeconds: number): void {
    const nextPlayerElapsed = this.playerElapsed + deltaSeconds;
    this.playerElapsed =
      PLAYER_TWEEN_DURATION - nextPlayerElapsed <= COOLDOWN_EPSILON
        ? PLAYER_TWEEN_DURATION
        : nextPlayerElapsed;
    for (const consumption of this.cellConsumptions) consumption.elapsed += deltaSeconds;
    this.cellConsumptions = this.cellConsumptions.filter(
      (consumption) => consumption.duration - consumption.elapsed > COOLDOWN_EPSILON,
    );
    for (const motion of this.tileMotions) motion.elapsed += deltaSeconds;
    this.tileMotions = this.tileMotions.filter(
      (motion) => motion.duration - motion.elapsed > COOLDOWN_EPSILON,
    );
  }

  public startPlayerMotion(): void {
    this.playerElapsed = 0;
  }

  public isPlayerSettled(): boolean {
    return this.playerElapsed >= PLAYER_TWEEN_DURATION;
  }

  public playerProgress(): number {
    return clamp01(this.playerElapsed / PLAYER_TWEEN_DURATION);
  }

  public startCellConsumption(
    tile: CellConsumption['tile'],
    position: Point,
    direction: Direction,
    kind: CellConsumption['kind'],
    duration: number,
  ): void {
    this.cellConsumptions = this.cellConsumptions.filter(
      (consumption) => !isSamePoint(consumption.position, position),
    );
    this.cellConsumptions.push({
      tile,
      position: { ...position },
      direction,
      kind,
      duration,
      elapsed: 0,
    });
  }

  public clearCellConsumptions(): void {
    this.cellConsumptions = [];
  }

  public cellSnapshot(): readonly CellConsumption[] {
    return this.cellConsumptions.map((consumption) => ({
      tile: consumption.tile,
      position: consumption.position,
      direction: consumption.direction,
      kind: consumption.kind,
      progress: clamp01(consumption.elapsed / consumption.duration),
      durationSeconds: consumption.duration,
    }));
  }

  public startTileMotion(
    tile: Tile,
    from: Point,
    to: Point,
    kind: TileMotionKind,
    duration: number,
  ): void {
    this.tileMotions = this.tileMotions.filter(
      (motion) => !isSamePoint(motion.to, from) && !isSamePoint(motion.to, to),
    );
    this.tileMotions.push({
      tile,
      from: { ...from },
      to: { ...to },
      kind,
      duration,
      elapsed: 0,
    });
  }

  public hasActivePushTo(position: Point): boolean {
    return this.tileMotions.some(
      (motion) => motion.kind === 'push' && isSamePoint(motion.to, position),
    );
  }

  public visibleTileMotions(tileAt: (x: number, y: number) => Tile): readonly TileMotion[] {
    return this.tileMotions
      .filter((motion) => tileAt(motion.to.x, motion.to.y) === motion.tile)
      .map((motion) => ({
        tile: motion.tile,
        from: motion.from,
        to: motion.to,
        kind: motion.kind,
        progress: clamp01(motion.elapsed / motion.duration),
        durationSeconds: motion.duration,
      }));
  }
}

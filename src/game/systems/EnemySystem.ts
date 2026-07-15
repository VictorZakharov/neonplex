import {
  DIRECTION_VECTOR,
  Tile,
  type Direction,
  type EnemyPose,
  type Point,
} from '../types';
import {
  clamp01,
  COOLDOWN_EPSILON,
  ENEMY_TURN_DURATION,
} from '../gameTiming';
import type { ActiveEnemyTurn, EnemyWorld } from '../internalTypes';

const isSamePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** Owns Sentinel direction, turn state, navigation and movement. */
export class EnemySystem {
  private directions = new Map<number, Direction>();
  private turns = new Map<number, ActiveEnemyTurn>();

  public constructor(initial: ReadonlyMap<number, Direction>) {
    this.reset(initial);
  }

  public reset(initial: ReadonlyMap<number, Direction>): void {
    this.directions = new Map(initial);
    this.turns.clear();
  }

  public advanceTurns(deltaSeconds: number): void {
    for (const turn of this.turns.values()) {
      turn.elapsed = Math.min(turn.duration, turn.elapsed + deltaSeconds);
    }
  }

  public snapshot(world: EnemyWorld): readonly EnemyPose[] {
    return [...this.directions.entries()]
      .filter(([index]) => world.tileAtIndex(index) === Tile.Enemy)
      .map(([index, facing]) => {
        const turn = this.turns.get(index);
        return {
          position: world.pointFromIndex(index),
          facing,
          turnFrom: turn?.from ?? null,
          turnProgress: turn === undefined ? 1 : clamp01(turn.elapsed / turn.duration),
          turnDurationSeconds: turn?.duration ?? ENEMY_TURN_DURATION,
        };
      });
  }

  public removeAt(index: number): void {
    this.directions.delete(index);
    this.turns.delete(index);
  }

  public update(world: EnemyWorld): void {
    const current = [...this.directions.entries()].sort(([a], [b]) => a - b);
    const nextDirections = new Map<number, Direction>();
    const nextTurns = new Map<number, ActiveEnemyTurn>();
    const claimed = new Set<number>();

    for (const [sourceIndex, facing] of current) {
      if (world.tileAtIndex(sourceIndex) !== Tile.Enemy) continue;
      const source = world.pointFromIndex(sourceIndex);
      const activeTurn = this.turns.get(sourceIndex);
      if (
        activeTurn !== undefined &&
        activeTurn.duration - activeTurn.elapsed > COOLDOWN_EPSILON
      ) {
        nextDirections.set(sourceIndex, facing);
        nextTurns.set(sourceIndex, activeTurn);
        continue;
      }

      const navigationFacing = activeTurn?.from ?? facing;
      const direction = this.chooseDirection(world, source, navigationFacing, claimed);
      if (direction === undefined) {
        nextDirections.set(sourceIndex, facing);
        continue;
      }

      if (direction !== facing) {
        nextDirections.set(sourceIndex, direction);
        nextTurns.set(sourceIndex, {
          from: facing,
          to: direction,
          duration: ENEMY_TURN_DURATION,
          elapsed: 0,
        });
        continue;
      }

      const vector = DIRECTION_VECTOR[direction];
      const target = { x: source.x + vector.x, y: source.y + vector.y };
      if (!this.canEnter(world, target, claimed)) {
        nextDirections.set(sourceIndex, direction);
        continue;
      }

      const targetIndex = world.index(target.x, target.y);
      world.setTileAtIndex(sourceIndex, Tile.Empty);
      world.setTileAtIndex(targetIndex, Tile.Enemy);
      world.startEnemyMotion(source, target);
      nextDirections.set(targetIndex, direction);
      if (isSamePoint(target, world.playerPosition())) {
        world.killPlayer(target);
      } else {
        claimed.add(targetIndex);
        world.emit('enemy', target, 0.2);
      }
    }
    this.directions = nextDirections;
    this.turns = nextTurns;
  }

  private chooseDirection(
    world: EnemyWorld,
    source: Point,
    facing: Direction,
    claimed: ReadonlySet<number>,
  ): Direction | undefined {
    const candidates = this.candidates(facing);
    return candidates.find((candidate) => {
      const target = this.step(source, candidate);
      return (
        this.canEnter(world, target, claimed) &&
        this.hasLiveWallContact(world, target)
      );
    });
  }

  private canEnter(world: EnemyWorld, target: Point, claimed: ReadonlySet<number>): boolean {
    if (
      target.x < 0 ||
      target.y < 0 ||
      target.x >= world.width ||
      target.y >= world.height
    ) {
      return false;
    }
    if (isSamePoint(target, world.playerPosition())) return true;
    const targetIndex = world.index(target.x, target.y);
    return world.tileAt(target.x, target.y) === Tile.Empty && !claimed.has(targetIndex);
  }

  private isSolid(world: EnemyWorld, point: Point): boolean {
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= world.width ||
      point.y >= world.height
    ) {
      return true;
    }
    const tile = world.tileAt(point.x, point.y);
    return tile !== Tile.Empty && tile !== Tile.Enemy && tile !== Tile.Explosion;
  }

  private hasLiveWallContact(world: EnemyWorld, point: Point): boolean {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue;
        if (this.isSolid(world, { x: point.x + offsetX, y: point.y + offsetY })) {
          return true;
        }
      }
    }
    return false;
  }

  private step(source: Point, direction: Direction): Point {
    const vector = DIRECTION_VECTOR[direction];
    return { x: source.x + vector.x, y: source.y + vector.y };
  }

  private candidates(facing: Direction): readonly Direction[] {
    const directions: readonly Direction[] = ['up', 'right', 'down', 'left'];
    const current = directions.indexOf(facing);
    return [
      directions[(current + 1) % 4] ?? 'right',
      facing,
      directions[(current + 3) % 4] ?? 'left',
      directions[(current + 2) % 4] ?? 'down',
    ];
  }
}

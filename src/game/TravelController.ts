import type { TravelWorld } from './internalTypes';
import {
  DIRECTION_VECTOR,
  Tile,
  type Direction,
  type InputFrame,
  type Point,
} from './types';

const isSamePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

const isTravelTile = (tile: Tile): boolean =>
  tile === Tile.Empty ||
  tile === Tile.Dirt ||
  tile === Tile.Infotron ||
  tile === Tile.Disk ||
  tile === Tile.ExitOpen;

export class TravelController {
  private target: Point | null = null;

  public constructor(private readonly world: TravelWorld) {}

  public directionFor(input: InputFrame): Direction | null {
    const hasManualInput =
      input.direction !== null || input.action || input.excavate !== null;
    if (hasManualInput || input.travelTarget === null) {
      this.clear();
      return null;
    }
    if (input.travelTarget !== undefined) this.setTarget(input.travelTarget);
    return this.nextDirection();
  }

  public completeStep(): void {
    if (
      this.target !== null &&
      isSamePoint(this.world.playerPosition(), this.target)
    ) {
      this.clear();
    }
  }

  public clear(): void {
    this.target = null;
  }

  private setTarget(target: Point): void {
    this.clear();
    if (!this.isValidTarget(target)) return;
    this.target = { ...target };
  }

  private isValidTarget(target: Point): boolean {
    const player = this.world.playerPosition();
    if (
      !Number.isInteger(target.x) ||
      !Number.isInteger(target.y) ||
      !this.world.isInside(target.x, target.y) ||
      isSamePoint(target, player)
    ) {
      return false;
    }

    const direction = this.directionTo(target);
    if (direction === null) return false;
    const vector = DIRECTION_VECTOR[direction];
    for (
      let position = { x: player.x + vector.x, y: player.y + vector.y };
      ;
      position = { x: position.x + vector.x, y: position.y + vector.y }
    ) {
      if (!isTravelTile(this.world.tileAt(position.x, position.y))) return false;
      if (isSamePoint(position, target)) return true;
    }
  }

  private nextDirection(): Direction | null {
    if (this.target === null) return null;
    const direction = this.directionTo(this.target);
    if (direction === null) {
      this.clear();
      return null;
    }

    const player = this.world.playerPosition();
    const vector = DIRECTION_VECTOR[direction];
    const next = { x: player.x + vector.x, y: player.y + vector.y };
    if (!isTravelTile(this.world.tileAt(next.x, next.y))) {
      this.clear();
      return null;
    }
    return direction;
  }

  private directionTo(target: Point): Direction | null {
    const player = this.world.playerPosition();
    if (target.y === player.y) {
      if (target.x < player.x) return 'left';
      if (target.x > player.x) return 'right';
    }
    if (target.x === player.x) {
      if (target.y < player.y) return 'up';
      if (target.y > player.y) return 'down';
    }
    return null;
  }
}

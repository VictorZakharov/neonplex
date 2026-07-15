import type {
  Direction,
  CellConsumption,
  GameEvent,
  Point,
  Tile,
  TileMotionKind,
} from './types';

export interface ParsedLevel {
  readonly width: number;
  readonly height: number;
  readonly tiles: Tile[];
  readonly spawn: Point;
  readonly required: number;
  readonly enemies: ReadonlyMap<number, Direction>;
}

export interface ActiveTileMotion {
  readonly tile: Tile;
  readonly from: Point;
  readonly to: Point;
  readonly kind: TileMotionKind;
  readonly duration: number;
  elapsed: number;
}

export interface ActiveCellConsumption {
  readonly tile: CellConsumption['tile'];
  readonly position: Point;
  readonly direction: Direction;
  readonly kind: CellConsumption['kind'];
  readonly duration: number;
  elapsed: number;
}

export interface ActiveEnemyTurn {
  readonly from: Direction;
  readonly to: Direction;
  readonly duration: number;
  elapsed: number;
}

export interface EnemyWorld {
  readonly width: number;
  readonly height: number;
  tileAt(x: number, y: number): Tile;
  tileAtIndex(index: number): Tile;
  setTileAtIndex(index: number, tile: Tile): void;
  playerPosition(): Point;
  index(x: number, y: number): number;
  pointFromIndex(index: number): Point;
  startEnemyMotion(from: Point, to: Point): void;
  killPlayer(position: Point): void;
  emit(type: GameEvent['type'], position: Point, intensity: number): void;
}

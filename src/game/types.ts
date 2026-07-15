export const enum Tile {
  Empty = 0,
  Dirt = 1,
  Steel = 2,
  Wall = 3,
  Infotron = 4,
  Zonk = 5,
  ExitClosed = 6,
  ExitOpen = 7,
  Enemy = 8,
  Disk = 9,
  Bomb = 10,
  Explosion = 11,
  Carbon = 12,
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GamePhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly briefing: string;
  readonly parSeconds: number;
  readonly map: readonly string[];
}

export interface InputFrame {
  readonly direction: Direction | null;
  readonly action: boolean;
  readonly excavate: Direction | null;
  readonly stepDirection?: Direction | null;
  readonly travelTarget?: Point | null;
}

export type GameEventType =
  | 'move'
  | 'dig'
  | 'collect'
  | 'disk-pickup'
  | 'disk-deploy'
  | 'push'
  | 'impact'
  | 'enemy'
  | 'exit-open'
  | 'explode'
  | 'death'
  | 'win';

export interface GameEvent {
  readonly type: GameEventType;
  readonly position: Point;
  readonly intensity?: number;
}

export type TileMotionKind = 'fall' | 'roll' | 'push' | 'enemy';

export interface TileMotion {
  readonly tile: Tile;
  readonly from: Point;
  readonly to: Point;
  readonly progress: number;
  readonly durationSeconds: number;
  readonly kind: TileMotionKind;
}

export interface CellConsumption {
  readonly tile: Tile.Dirt | Tile.Infotron | Tile.Disk;
  readonly position: Point;
  readonly direction: Direction;
  readonly kind: 'traverse' | 'remote';
  readonly progress: number;
  readonly durationSeconds: number;
}

export interface EnemyPose {
  readonly position: Point;
  readonly facing: Direction;
  readonly turnFrom: Direction | null;
  readonly turnProgress: number;
  readonly turnDurationSeconds: number;
}

export interface GameSnapshot {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly tileMotions: readonly TileMotion[];
  readonly player: Point;
  readonly previousPlayer: Point;
  readonly playerMotion: number;
  readonly playerMotionDurationSeconds: number;
  readonly cellConsumptions: readonly CellConsumption[];
  readonly enemies: readonly EnemyPose[];
  readonly facing: Direction;
  readonly collected: number;
  readonly required: number;
  readonly disks: number;
  readonly score: number;
  readonly elapsedSeconds: number;
  readonly phase: GamePhase;
  readonly levelIndex: number;
  readonly levelName: string;
  readonly tick: number;
  readonly gravityProgress: number;
}

export const DIRECTION_VECTOR: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

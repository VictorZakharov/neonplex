import type { Tile } from '../game/types';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface BoardLayout {
  readonly tile: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PlayerScreenAnchor {
  readonly x: number;
  readonly y: number;
  readonly tileSize: number;
}

export interface CameraFocus {
  readonly x: number;
  readonly y: number;
}

export interface NormalizedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ZoomAnchorAxisInput {
  readonly cameraOffset: number;
  readonly focusGridCoordinate: number;
  readonly previousTileSize: number;
  readonly nextTileSize: number;
  readonly boardCells: number;
  readonly viewportSize: number;
  readonly padding: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface EdgeIndicator {
  readonly position: ScreenPoint;
  readonly angle: number;
}

export interface TileRenderEntry {
  readonly tile: Tile;
  readonly gridX: number;
  readonly gridY: number;
  readonly x: number;
  readonly y: number;
  readonly enemyAngle: number | undefined;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
}

export interface ParticleConfig {
  readonly count: number;
  readonly speed: number;
  readonly lift: number;
  readonly life: number;
  readonly size: number;
  readonly drag: number;
  readonly colors: readonly string[];
}

export interface ScreenShakeOffset {
  readonly x: number;
  readonly y: number;
}

export type IntelPreviewKind =
  | 'player'
  | 'dirt'
  | 'infotron'
  | 'zonk'
  | 'wall'
  | 'steel'
  | 'carbon'
  | 'exit'
  | 'enemy'
  | 'disk'
  | 'map'
  | 'cascade'
  | 'chain';

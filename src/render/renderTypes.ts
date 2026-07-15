import type { Direction, Point, Tile } from '../game/types';

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

export interface CameraInteractionCallbacks {
  readonly onPlayerDirection?: (direction: Direction | null) => void;
  readonly onTravelTarget?: (target: Point) => void;
  readonly onCancelTravel?: () => void;
  readonly onUserGesture?: () => void;
}

export interface PinchGestureUpdate {
  readonly previousCentroid: ScreenPoint;
  readonly nextCentroid: ScreenPoint;
  readonly previousDistance: number;
  readonly nextDistance: number;
}

export interface CanvasGestureHost {
  readonly getViewport: () => Viewport;
  readonly getPlayerScreenAnchor: () => PlayerScreenAnchor | null;
  readonly beginPan: () => void;
  readonly panBy: (displacement: ScreenPoint) => void;
  readonly applyPinch: (update: PinchGestureUpdate) => void;
  readonly dispatchTap: (point: ScreenPoint) => void;
  readonly zoomFromWheel: (zoomIn: boolean, focalPoint: ScreenPoint) => void;
}

export interface PinchCameraInput {
  readonly cameraLeft: number;
  readonly cameraTop: number;
  readonly previousCentroid: ScreenPoint;
  readonly nextCentroid: ScreenPoint;
  readonly previousDistance: number;
  readonly nextDistance: number;
  readonly baseTileSize: number;
  readonly zoom: number;
  readonly minimumZoom: number;
  readonly maximumZoom: number;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly viewport: Viewport;
  readonly padding: number;
}

export interface CameraTransform {
  readonly left: number;
  readonly top: number;
  readonly zoom: number;
}

export interface ViewportCenterCameraInput {
  readonly cameraLeft: number;
  readonly cameraTop: number;
  readonly previousViewport: Viewport;
  readonly nextViewport: Viewport;
  readonly previousTileSize: number;
  readonly nextTileSize: number;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly padding: number;
}

export type TouchGestureMode = 'idle' | 'tap' | 'pan' | 'player' | 'pinch';

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
  | 'touch'
  | 'map'
  | 'cascade'
  | 'chain';

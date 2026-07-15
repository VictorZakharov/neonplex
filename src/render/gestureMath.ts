import type { Direction, Point } from '../game/types';
import { clampCameraAxis } from './cameraMath';
import type {
  BoardLayout,
  CameraTransform,
  PinchCameraInput,
  PlayerScreenAnchor,
  ScreenPoint,
  ViewportCenterCameraInput,
} from './renderTypes';

const EPSILON = 0.001;
const PINCH_SCALE_LOG_THRESHOLD = 0.008;

export const distanceBetween = (first: ScreenPoint, second: ScreenPoint): number =>
  Math.hypot(second.x - first.x, second.y - first.y);

export const midpointBetween = (
  first: ScreenPoint,
  second: ScreenPoint,
): ScreenPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

export const directionFromDisplacement = (
  displacement: ScreenPoint,
  previousDirection: Direction | null,
  deadZone: number,
  axisSwitchRatio = 1.2,
): Direction | null => {
  const horizontal = Math.abs(displacement.x);
  const vertical = Math.abs(displacement.y);
  if (Math.hypot(horizontal, vertical) <= deadZone) return null;

  let useHorizontal = horizontal >= vertical;
  if (previousDirection !== null) {
    const wasHorizontal = previousDirection === 'left' || previousDirection === 'right';
    if (useHorizontal !== wasHorizontal) {
      const candidateMagnitude = useHorizontal ? horizontal : vertical;
      const previousAxisMagnitude = useHorizontal ? vertical : horizontal;
      if (candidateMagnitude < previousAxisMagnitude * axisSwitchRatio) {
        useHorizontal = wasHorizontal;
      }
    }
  }

  if (useHorizontal) return displacement.x < 0 ? 'left' : 'right';
  return displacement.y < 0 ? 'up' : 'down';
};

export const playerGestureRadius = (tileSize: number): number =>
  Math.max(28, tileSize * 0.6);

export const isPlayerHit = (
  point: ScreenPoint,
  player: PlayerScreenAnchor | null,
): boolean => {
  if (player === null) return false;
  const radius = playerGestureRadius(player.tileSize);
  return Math.hypot(point.x - player.x, point.y - player.y) <= radius;
};

/** Ignores sub-percent pinch sensor noise while allowing deliberate motion to accumulate. */
export const stabilizedPinchDistance = (
  baselineDistance: number,
  candidateDistance: number,
  logThreshold = PINCH_SCALE_LOG_THRESHOLD,
): number => {
  const baseline = Math.max(EPSILON, baselineDistance);
  const candidate = Math.max(EPSILON, candidateDistance);
  return Math.abs(Math.log(candidate / baseline)) >= Math.max(0, logThreshold)
    ? candidate
    : baseline;
};

export const gridPointAtScreen = (
  point: ScreenPoint,
  layout: BoardLayout | null,
): Point | null => {
  if (layout === null || layout.tile <= 0) return null;
  const x = Math.floor((point.x - layout.left) / layout.tile);
  const y = Math.floor((point.y - layout.top) / layout.tile);
  const columns = Math.round(layout.width / layout.tile);
  const rows = Math.round(layout.height / layout.tile);
  if (x < 0 || y < 0 || x >= columns || y >= rows) return null;
  return { x, y };
};

export const transformCameraForPinch = (input: PinchCameraInput): CameraTransform => {
  const previousTile = input.baseTileSize * input.zoom;
  const ratio = input.nextDistance / Math.max(input.previousDistance, EPSILON);
  const zoom = Math.max(
    input.minimumZoom,
    Math.min(input.maximumZoom, input.zoom * ratio),
  );
  const nextTile = input.baseTileSize * zoom;
  const worldX = (input.previousCentroid.x - input.cameraLeft) / previousTile;
  const worldY = (input.previousCentroid.y - input.cameraTop) / previousTile;
  return {
    left: clampCameraAxis(
      input.nextCentroid.x - worldX * nextTile,
      input.boardWidth * nextTile,
      input.viewport.width,
      input.padding,
    ),
    top: clampCameraAxis(
      input.nextCentroid.y - worldY * nextTile,
      input.boardHeight * nextTile,
      input.viewport.height,
      input.padding,
    ),
    zoom,
  };
};

export const preserveViewportWorldCenter = (
  input: ViewportCenterCameraInput,
): CameraTransform => {
  const worldX =
    (input.previousViewport.width / 2 - input.cameraLeft) / input.previousTileSize;
  const worldY =
    (input.previousViewport.height / 2 - input.cameraTop) / input.previousTileSize;
  return {
    left: clampCameraAxis(
      input.nextViewport.width / 2 - worldX * input.nextTileSize,
      input.boardWidth * input.nextTileSize,
      input.nextViewport.width,
      input.padding,
    ),
    top: clampCameraAxis(
      input.nextViewport.height / 2 - worldY * input.nextTileSize,
      input.boardHeight * input.nextTileSize,
      input.nextViewport.height,
      input.padding,
    ),
    zoom: 1,
  };
};

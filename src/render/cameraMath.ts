import type { ZoomAnchorAxisInput } from './renderTypes';

export type { ZoomAnchorAxisInput } from './renderTypes';

export const clampCameraAxis = (
  target: number,
  boardSize: number,
  viewportSize: number,
  padding: number,
): number => {
  if (boardSize <= viewportSize - padding * 2) return (viewportSize - boardSize) / 2;
  return Math.max(viewportSize - padding - boardSize, Math.min(padding, target));
};

export const preserveZoomAnchorAxis = (input: ZoomAnchorAxisInput): number => {
  const focusScreenCoordinate =
    input.cameraOffset + input.focusGridCoordinate * input.previousTileSize;
  return clampCameraAxis(
    focusScreenCoordinate - input.focusGridCoordinate * input.nextTileSize,
    input.boardCells * input.nextTileSize,
    input.viewportSize,
    input.padding,
  );
};

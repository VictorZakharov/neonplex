import { clampCameraAxis, preserveZoomAnchorAxis } from './cameraMath';

describe('cameraMath', () => {
  it('preserves the focused object screen coordinate while zooming', () => {
    const focus = 15.5;
    const previousTile = 40;
    const nextTile = 50;
    const previousOffset = -220;
    const previousScreenCoordinate = previousOffset + focus * previousTile;
    const nextOffset = preserveZoomAnchorAxis({
      cameraOffset: previousOffset,
      focusGridCoordinate: focus,
      previousTileSize: previousTile,
      nextTileSize: nextTile,
      boardCells: 40,
      viewportSize: 800,
      padding: 20,
    });

    expect(nextOffset + focus * nextTile).toBe(previousScreenCoordinate);
  });

  it('centers a board that is smaller than the viewport', () => {
    expect(clampCameraAxis(-100, 400, 800, 20)).toBe(200);
  });

  it('keeps zoom anchoring inside the board-edge bounds', () => {
    const nextOffset = preserveZoomAnchorAxis({
      cameraOffset: 20,
      focusGridCoordinate: 1.5,
      previousTileSize: 40,
      nextTileSize: 70,
      boardCells: 40,
      viewportSize: 800,
      padding: 20,
    });
    expect(nextOffset).toBeLessThanOrEqual(20);
    expect(nextOffset).toBeGreaterThanOrEqual(800 - 20 - 40 * 70);
  });
});

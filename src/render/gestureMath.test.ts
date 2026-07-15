import {
  directionFromDisplacement,
  gridPointAtScreen,
  isPlayerHit,
  preserveViewportWorldCenter,
  stabilizedPinchDistance,
  transformCameraForPinch,
} from './gestureMath';

describe('gestureMath', () => {
  it('uses a dead zone and keeps the dominant direction stable near a diagonal', () => {
    expect(directionFromDisplacement({ x: 5, y: 4 }, null, 10)).toBeNull();
    expect(directionFromDisplacement({ x: 10, y: 0 }, null, 10)).toBeNull();
    expect(directionFromDisplacement({ x: 30, y: 8 }, null, 10)).toBe('right');
    expect(directionFromDisplacement({ x: 24, y: 25 }, 'right', 10)).toBe('right');
    expect(directionFromDisplacement({ x: 20, y: 30 }, 'right', 10)).toBe('down');
  });

  it('maps visible canvas coordinates to board cells and rejects the margins', () => {
    const layout = { left: -20, top: 10, tile: 40, width: 400, height: 240 };
    expect(gridPointAtScreen({ x: 65, y: 95 }, layout)).toEqual({ x: 2, y: 2 });
    expect(gridPointAtScreen({ x: -21, y: 95 }, layout)).toBeNull();
    expect(gridPointAtScreen({ x: 400, y: 95 }, layout)).toBeNull();
  });

  it('uses a finger-sized minimum hit target around the player', () => {
    const player = { x: 100, y: 100, tileSize: 30 };
    expect(isPlayerHit({ x: 127, y: 100 }, player)).toBe(true);
    expect(isPlayerHit({ x: 128, y: 100 }, player)).toBe(true);
    expect(isPlayerHit({ x: 129, y: 100 }, player)).toBe(false);
  });

  it('preserves the world position beneath a moving pinch midpoint', () => {
    const result = transformCameraForPinch({
      cameraLeft: -400,
      cameraTop: -220,
      previousCentroid: { x: 300, y: 220 },
      nextCentroid: { x: 330, y: 240 },
      previousDistance: 100,
      nextDistance: 125,
      baseTileSize: 40,
      zoom: 1,
      minimumZoom: 0.68,
      maximumZoom: 1.72,
      boardWidth: 40,
      boardHeight: 24,
      viewport: { width: 800, height: 600 },
      padding: 20,
    });

    expect(result.zoom).toBe(1.25);
    const worldX = (300 - -400) / 40;
    const worldY = (220 - -220) / 40;
    expect(result.left + worldX * 50).toBe(330);
    expect(result.top + worldY * 50).toBe(240);
  });

  it('clamps physical pinch zoom and remains inside camera bounds', () => {
    const result = transformCameraForPinch({
      cameraLeft: 20,
      cameraTop: 20,
      previousCentroid: { x: 40, y: 40 },
      nextCentroid: { x: 40, y: 40 },
      previousDistance: 10,
      nextDistance: 100,
      baseTileSize: 40,
      zoom: 1,
      minimumZoom: 0.68,
      maximumZoom: 1.72,
      boardWidth: 40,
      boardHeight: 24,
      viewport: { width: 800, height: 600 },
      padding: 20,
    });
    expect(result.zoom).toBe(1.72);
    expect(result.left).toBeLessThanOrEqual(20);
    expect(result.top).toBeLessThanOrEqual(20);
  });

  it('rejects pinch sensor jitter without losing cumulative deliberate motion', () => {
    const baseline = 200;
    expect(stabilizedPinchDistance(baseline, 199.5)).toBe(baseline);
    expect(stabilizedPinchDistance(baseline, 200.1)).toBe(baseline);
    expect(stabilizedPinchDistance(baseline, 198.3)).toBe(198.3);
  });

  it('keeps max zoom stable through noisy pinch samples and exits on intent', () => {
    let baseline = 200;
    let zoom = 1.72;
    for (const distance of [199.5, 200.1, 199.6, 200]) {
      const stableDistance = stabilizedPinchDistance(baseline, distance);
      zoom = Math.min(1.72, zoom * (stableDistance / baseline));
      baseline = stableDistance;
    }
    expect(zoom).toBe(1.72);

    const deliberateDistance = stabilizedPinchDistance(baseline, 198.3);
    zoom = Math.min(1.72, zoom * (deliberateDistance / baseline));
    expect(zoom).toBeLessThan(1.72);
  });

  it('preserves a manually panned world center when orientation changes tile size', () => {
    const result = preserveViewportWorldCenter({
      cameraLeft: -500,
      cameraTop: -500,
      previousViewport: { width: 800, height: 500 },
      nextViewport: { width: 500, height: 800 },
      previousTileSize: 50,
      nextTileSize: 32,
      boardWidth: 40,
      boardHeight: 30,
      padding: 20,
    });
    const worldXBefore = (800 / 2 - -500) / 50;
    const worldYBefore = (500 / 2 - -500) / 50;
    expect((500 / 2 - result.left) / 32).toBe(worldXBefore);
    expect((800 / 2 - result.top) / 32).toBe(worldYBefore);
  });
});

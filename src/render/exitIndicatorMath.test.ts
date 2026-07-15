import { offscreenEdgeIndicator } from './exitIndicatorMath';

const VIEWPORT = { width: 800, height: 600 };

describe('offscreenEdgeIndicator', () => {
  it('does not duplicate an exit that is fully or partially visible', () => {
    expect(offscreenEdgeIndicator({ x: 400, y: 300 }, VIEWPORT, 20, 30)).toBeNull();
    expect(offscreenEdgeIndicator({ x: -10, y: 300 }, VIEWPORT, 20, 30)).toBeNull();
  });

  it('clamps a right-side exit to the safe screen edge', () => {
    const indicator = offscreenEdgeIndicator({ x: 1_200, y: 300 }, VIEWPORT, 20, 30);
    expect(indicator?.position).toEqual({ x: 770, y: 300 });
    expect(indicator?.angle).toBeCloseTo(0, 10);
  });

  it('points toward an offscreen corner while remaining inside both edges', () => {
    const indicator = offscreenEdgeIndicator({ x: -400, y: -500 }, VIEWPORT, 20, 30);
    expect(indicator).not.toBeNull();
    expect(indicator?.position.x).toBeGreaterThanOrEqual(30);
    expect(indicator?.position.y).toBeGreaterThanOrEqual(30);
    expect(indicator?.angle).toBeLessThan(-Math.PI / 2);
  });
});

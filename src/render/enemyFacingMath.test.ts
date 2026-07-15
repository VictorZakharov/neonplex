import { directionAngle, enemyFacingAngle, shortestAngleDelta } from './enemyFacingMath';

describe('enemy facing animation', () => {
  it('turns through the shortest quarter-turn in either direction', () => {
    expect(enemyFacingAngle('right', 'down', 0.5)).toBeCloseTo(Math.PI / 4, 10);
    expect(enemyFacingAngle('right', 'up', 0.5)).toBeCloseTo(-Math.PI / 4, 10);
  });

  it('uses a consistent clockwise half-turn', () => {
    expect(shortestAngleDelta(directionAngle('right'), directionAngle('left'))).toBeCloseTo(
      Math.PI,
      10,
    );
  });

  it('clamps to exact start and end orientations', () => {
    expect(enemyFacingAngle('up', 'left', -1)).toBeCloseTo(directionAngle('up'), 10);
    expect(enemyFacingAngle('up', 'left', 2)).toBeCloseTo(directionAngle('left'), 10);
  });
});

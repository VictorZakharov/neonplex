import { exponentialApproach, interpolatedProgress, remainingDirtRect } from './animationMath';

describe('interpolatedProgress', () => {
  it('creates distinct visual positions between 60 Hz simulation ticks on a 144 Hz display', () => {
    const frameSeconds = 1 / 144;
    const durationSeconds = 0.085;
    const first = interpolatedProgress(0, frameSeconds, durationSeconds);
    const second = interpolatedProgress(0, frameSeconds * 2, durationSeconds);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });

  it('is continuous when accumulated render time becomes a simulation tick', () => {
    const durationSeconds = 0.15;
    const fixedStep = 1 / 60;
    const beforeTick = interpolatedProgress(0, fixedStep, durationSeconds);
    const afterTick = interpolatedProgress(fixedStep / durationSeconds, 0, durationSeconds);
    expect(afterTick).toBeCloseTo(beforeTick, 10);
  });

  it('clamps completed motion', () => {
    expect(interpolatedProgress(0.95, 1 / 60, 0.1)).toBe(1);
  });
});

describe('exponentialApproach', () => {
  it('moves monotonically toward its target without overshooting', () => {
    const next = exponentialApproach(1, 1.7, 16, 1 / 144);
    expect(next).toBeGreaterThan(1);
    expect(next).toBeLessThan(1.7);
  });

  it('is frame-rate independent across equivalent elapsed time', () => {
    const singleStep = exponentialApproach(1, 1.7, 16, 1 / 60);
    const halfStep = exponentialApproach(1, 1.7, 16, 1 / 120);
    const twoHalfSteps = exponentialApproach(halfStep, 1.7, 16, 1 / 120);
    expect(twoHalfSteps).toBeCloseTo(singleStep, 10);
  });
});

describe('remainingDirtRect', () => {
  it.each([
    ['right', { x: 0.5, y: 0, width: 0.5, height: 1 }],
    ['left', { x: 0, y: 0, width: 0.5, height: 1 }],
    ['down', { x: 0, y: 0.5, width: 1, height: 0.5 }],
    ['up', { x: 0, y: 0, width: 1, height: 0.5 }],
  ] as const)('clips %s travel from the entry edge', (direction, expected) => {
    expect(remainingDirtRect(direction, 0.5)).toEqual(expected);
  });

  it('clamps before the start and after the end of consumption', () => {
    expect(remainingDirtRect('right', -1)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(remainingDirtRect('right', 2)).toEqual({ x: 1, y: 0, width: 0, height: 1 });
  });
});

import { calculateJoystickState } from './joystickMath';

describe('calculateJoystickState', () => {
  it('keeps a centered pointer neutral', () => {
    expect(calculateJoystickState(0, 0, 50, 12)).toEqual({
      direction: null,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it.each([
    [30, 4, 'right'],
    [-30, 4, 'left'],
    [4, -30, 'up'],
    [4, 30, 'down'],
  ] as const)('uses the dominant axis for (%s, %s)', (x, y, direction) => {
    expect(calculateJoystickState(x, y, 50, 10).direction).toBe(direction);
  });

  it('clamps the visual thumb without changing the sampled direction', () => {
    const state = calculateJoystickState(60, 80, 50, 10);

    expect(state.direction).toBe('down');
    expect(state.offsetX).toBeCloseTo(30);
    expect(state.offsetY).toBeCloseTo(40);
    expect(Math.hypot(state.offsetX, state.offsetY)).toBeCloseTo(50);
  });

  it('requires the full dead zone distance to engage', () => {
    expect(calculateJoystickState(9, 0, 50, 10).direction).toBeNull();
    expect(calculateJoystickState(10, 0, 50, 10).direction).toBe('right');
  });

  it('uses a smaller release threshold for an engaged direction', () => {
    expect(calculateJoystickState(8, 0, 50, 10, 'right').direction).toBe('right');
    expect(calculateJoystickState(7, 0, 50, 10, 'right').direction).toBeNull();
  });

  it('resists axis flicker close to a diagonal', () => {
    expect(calculateJoystickState(20, 21, 50, 10, 'right').direction).toBe('right');
    expect(calculateJoystickState(20, 25, 50, 10, 'right').direction).toBe('down');
  });

  it('switches immediately across the center on the same axis', () => {
    expect(calculateJoystickState(-20, 0, 50, 10, 'right').direction).toBe('left');
  });

  it('stays neutral when no visual travel radius is available', () => {
    expect(calculateJoystickState(50, 0, 0, 0, 'right')).toEqual({
      direction: null,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

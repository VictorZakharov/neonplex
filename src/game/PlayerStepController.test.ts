import { PlayerStepController } from './PlayerStepController';
import { PLAYER_STEP_QUEUE_CAPACITY } from './playerStepConfig';
import type { Direction } from './types';

describe('PlayerStepController', () => {
  it('retains ordered finger steps through cooldown frames', () => {
    const steps = new PlayerStepController();

    expect(steps.accept('right')).toBe(true);
    expect(steps.accept('down')).toBe(true);

    expect(steps.directionFor(null, null)).toBe('right');
    expect(steps.directionFor(null, null)).toBe('right');

    steps.complete(null);
    expect(steps.directionFor(null, null)).toBe('down');

    steps.complete(null);
    expect(steps.directionFor(null, 'up')).toBe('up');
  });

  it('lets held input take priority without losing a pending finger step', () => {
    const steps = new PlayerStepController();
    steps.accept('left');

    expect(steps.directionFor('up', null)).toBe('up');
    steps.complete('up');
    expect(steps.directionFor(null, null)).toBe('left');
  });

  it('clears every pending step immediately', () => {
    const steps = new PlayerStepController();
    steps.accept('left');
    steps.accept('down');

    steps.clear();
    expect(steps.directionFor(null, null)).toBeNull();
  });

  it('applies two-step backpressure without replacing accepted turns', () => {
    const steps = new PlayerStepController();
    const accepted = Array.from(
      { length: PLAYER_STEP_QUEUE_CAPACITY },
      (_, index): Direction => (index % 2 === 0 ? 'right' : 'down'),
    );

    accepted.forEach((direction) => expect(steps.accept(direction)).toBe(true));
    expect(steps.accept('left')).toBe(false);

    accepted.forEach((direction) => {
      expect(steps.directionFor(null, null)).toBe(direction);
      steps.complete(null);
    });
    expect(steps.directionFor(null, null)).toBeNull();

    expect(steps.accept('left')).toBe(true);
  });
});

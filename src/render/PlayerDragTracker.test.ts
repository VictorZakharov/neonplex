import type { Direction } from '../game/types';
import { PlayerDragTracker } from './PlayerDragTracker';

describe('PlayerDragTracker', () => {
  it('maps finger distance to stable cell-sized steps', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker((direction) => steps.push(direction), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 17, y: 0 });
    tracker.update({ x: 39, y: 0 });
    tracker.update({ x: 55, y: 0 });
    expect(steps).toEqual(['right']);

    tracker.update({ x: 59, y: 0 });
    expect(steps).toEqual(['right', 'right']);
  });

  it('retains ordered cells and turns when one pointer sample crosses several', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker((direction) => steps.push(direction), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 80, y: -40 });

    expect(steps).toEqual(['right', 'right', 'up']);
  });

  it('walks back toward the finger without repeating while it is stationary', () => {
    const steps: Direction[] = [];
    const onEnd = jest.fn();
    const tracker = new PlayerDragTracker((direction) => steps.push(direction), onEnd);
    tracker.begin({ x: 0, y: 0 }, 40);
    tracker.update({ x: 80, y: 0 });
    tracker.update({ x: 80, y: 0 });
    tracker.update({ x: 0, y: 0 });
    tracker.end();

    expect(steps).toEqual(['right', 'right', 'left', 'left']);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

import type { Direction } from '../game/types';
import { PlayerDragTracker } from './PlayerDragTracker';
import type { ScreenPoint } from './renderTypes';

const acceptInto = (steps: Direction[]): ((direction: Direction) => boolean) =>
  (direction) => {
    steps.push(direction);
    return true;
  };

describe('PlayerDragTracker', () => {
  it('maps finger distance to stable cell-sized steps', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker(acceptInto(steps), jest.fn());
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
    const tracker = new PlayerDragTracker(acceptInto(steps), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 75, y: -18 });

    expect(steps).toEqual(['right', 'right', 'up']);
  });

  it('walks back toward the finger without repeating while it is stationary', () => {
    const steps: Direction[] = [];
    const onEnd = jest.fn();
    const tracker = new PlayerDragTracker(acceptInto(steps), onEnd);
    tracker.begin({ x: 0, y: 0 }, 40);
    tracker.update({ x: 80, y: 0 });
    tracker.update({ x: 80, y: 0 });
    tracker.update({ x: 0, y: 0 });
    tracker.end();

    expect(steps).toEqual(['right', 'right', 'left', 'left']);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not synthesize a correction step from perpendicular finger drift', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker(acceptInto(steps), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 93, y: 14 });

    expect(steps).toEqual(['right', 'right']);
  });

  it('never emits an opposite step along a monotonic path', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker(acceptInto(steps), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    for (const point of [
      { x: 31, y: 5 },
      { x: 62, y: 9 },
      { x: 93, y: 14 },
      { x: 124, y: 19 },
      { x: 155, y: 24 },
      { x: 186, y: 29 },
    ]) {
      tracker.update(point);
    }

    expect(steps).not.toContain('left');
    expect(steps).not.toContain('up');
  });

  it('produces the same ordered steps for coarse and fine samples of one path', () => {
    const coarseSteps: Direction[] = [];
    const fineSteps: Direction[] = [];
    const coarse = new PlayerDragTracker(acceptInto(coarseSteps), jest.fn());
    const fine = new PlayerDragTracker(acceptInto(fineSteps), jest.fn());
    coarse.begin({ x: 0, y: 0 }, 40);
    fine.begin({ x: 0, y: 0 }, 40);

    coarse.update({ x: 93, y: 14 });
    fine.update({ x: 31, y: 5 });
    fine.update({ x: 62, y: 9 });
    fine.update({ x: 93, y: 14 });

    expect(fineSteps).toEqual(coarseSteps);
    expect(coarseSteps).toEqual(['right', 'right']);
  });

  it('orders crossings identically for coarse and fine steep diagonal samples', () => {
    const coarseSteps: Direction[] = [];
    const fineSteps: Direction[] = [];
    const coarse = new PlayerDragTracker(acceptInto(coarseSteps), jest.fn());
    const fine = new PlayerDragTracker(acceptInto(fineSteps), jest.fn());
    coarse.begin({ x: 0, y: 0 }, 40);
    fine.begin({ x: 0, y: 0 }, 40);

    coarse.update({ x: 20, y: 100 });
    for (const point of [
      { x: 3.6, y: 18 },
      { x: 11.6, y: 58 },
      { x: 18, y: 90 },
      { x: 19.6, y: 98 },
      { x: 20, y: 100 },
    ]) {
      fine.update(point);
    }

    expect(coarseSteps).toEqual(['down', 'down', 'right', 'down']);
    expect(fineSteps).toEqual(coarseSteps);
  });

  it('uses the engage threshold when returning to an earlier axis', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker(acceptInto(steps), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 18, y: 0 });
    tracker.update({ x: 18, y: 18 });
    tracker.update({ x: 36, y: 18 });

    expect(steps).toEqual(['right', 'down', 'right']);
  });

  it('does not overcount a one-tile continuous diagonal', () => {
    const steps: Direction[] = [];
    const tracker = new PlayerDragTracker(acceptInto(steps), jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 40, y: 40 });

    expect(steps).toEqual(['right', 'down']);
  });

  it('retains unaccepted residual motion and retries it on the next sample', () => {
    const steps: Direction[] = [];
    let capacity = 1;
    const tracker = new PlayerDragTracker((direction) => {
      if (steps.length >= capacity) return false;
      steps.push(direction);
      return true;
    }, jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    tracker.update({ x: 80, y: 0 });
    expect(steps).toEqual(['right']);

    capacity = 2;
    tracker.update({ x: 81, y: 0 });
    expect(steps).toEqual(['right', 'right']);
  });

  it('coalesces samples while backpressured instead of building a stale path', () => {
    const tracker = new PlayerDragTracker(() => false, jest.fn());
    tracker.begin({ x: 0, y: 0 }, 40);

    for (let x = 20; x <= 200; x += 10) tracker.update({ x, y: 0 });

    const pending = Reflect.get(tracker, 'pendingSegments') as ScreenPoint[];
    expect(pending).toHaveLength(1);
  });

  it('rebases raw motion without ending an engaged gesture', () => {
    const steps: Direction[] = [];
    const onEnd = jest.fn();
    const tracker = new PlayerDragTracker(acceptInto(steps), onEnd);
    tracker.begin({ x: 0, y: 0 }, 40);
    tracker.update({ x: 80, y: 0 });

    tracker.rebase({ x: 80, y: 0 });
    tracker.update({ x: 119, y: 0 });

    expect(steps).toEqual(['right', 'right']);
    expect(tracker.isEngaged).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
  });
});

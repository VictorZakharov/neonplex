import { GameEngine } from '../game/GameEngine';
import { Tile, type InputFrame, type LevelDefinition } from '../game/types';
import { PlayerDragTracker } from '../render/PlayerDragTracker';
import { InputManager } from './InputManager';

const callbacks = {
  onPause: jest.fn(),
  onRestart: jest.fn(),
  onRestartHint: jest.fn(),
  onUserGesture: jest.fn(),
};

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'mobile-travel-bridge',
  name: 'Mobile Travel Bridge',
  sector: 'TEST',
  briefing: 'Input-to-engine integration fixture',
  parSeconds: 60,
  map,
});

const createHarness = (map: readonly string[]): {
  readonly engine: GameEngine;
  readonly input: InputManager;
} => {
  const engine = new GameEngine(definition(map), 0);
  engine.start();
  return {
    engine,
    input: new InputManager({} as HTMLElement, {
      ...callbacks,
      onPlayerStep: (direction) => engine.queuePlayerStep(direction),
      onCancelPlayerSteps: () => engine.cancelPlayerSteps(),
    }),
  };
};

const update = (engine: GameEngine, input: InputManager, frames = 1): void => {
  for (let frame = 0; frame < frames; frame += 1) {
    engine.update(1 / 60, input.consumeFrame());
  }
};

const applyFrame = (engine: GameEngine, frame: InputFrame): void => {
  engine.update(1 / 60, frame);
};

describe('mobile travel input bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards a straight tap route with smooth dirt traversal and stops at its target', () => {
    const { engine, input } = createHarness(['#######', '#@.. E#', '#######']);

    input.queueTravelTarget({ x: 4, y: 1 });
    const routeFrame = input.consumeFrame();
    expect(routeFrame.travelTarget).toEqual({ x: 4, y: 1 });
    applyFrame(engine, routeFrame);

    expect(engine.tileAt(2, 1)).toBe(Tile.Empty);
    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({
        previousPlayer: { x: 1, y: 1 },
        player: { x: 2, y: 1 },
        playerMotion: 0,
        cellConsumptions: [
          expect.objectContaining({
            tile: Tile.Dirt,
            position: { x: 2, y: 1 },
            kind: 'traverse',
            progress: 0,
          }),
        ],
      }),
    );

    update(engine, input, 3);
    expect(engine.getSnapshot().playerMotion).toBeCloseTo(0.5, 10);
    expect(engine.getSnapshot().cellConsumptions[0]?.progress).toBeCloseTo(0.5, 10);

    update(engine, input, 18);
    expect(engine.getSnapshot().player).toEqual({ x: 4, y: 1 });
  });

  it('lets recent player-drag motion move one cell without running to a wall', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);
    input.queueTravelTarget({ x: 5, y: 1 });
    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    const drag = new PlayerDragTracker(
      (direction) => input.queuePlayerStep(direction),
      () => input.endPlayerDrag(),
    );
    drag.begin({ x: 0, y: 0 }, 30);
    drag.update({ x: -20, y: 0 });
    const dragFrame = input.consumeFrame();
    expect(dragFrame).toEqual({
      direction: null,
      action: false,
      excavate: null,
      travelTarget: null,
    });
    applyFrame(engine, dragFrame);
    update(engine, input, 7);

    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
    drag.end();
    applyFrame(engine, input.consumeFrame());
    update(engine, input, 24);
    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
  });

  it('limits a drag burst to the engine two-step queue capacity', () => {
    const { engine, input } = createHarness([
      '#######',
      '#@   E#',
      '#     #',
      '#######',
    ]);

    expect(input.queuePlayerStep('right')).toBe(true);
    expect(input.queuePlayerStep('down')).toBe(true);
    expect(input.queuePlayerStep('left')).toBe(false);

    const visited: { x: number; y: number }[] = [];
    let previous = engine.getSnapshot().player;
    for (let frame = 0; frame < 30; frame += 1) {
      update(engine, input);
      const current = engine.getSnapshot().player;
      if (current.x !== previous.x || current.y !== previous.y) {
        visited.push({ ...current });
        previous = current;
      }
    }

    expect(visited).toEqual([
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('cancels queued drag motion immediately when the finger is released', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);

    expect(input.queuePlayerStep('right')).toBe(true);
    expect(input.queuePlayerStep('right')).toBe(true);
    input.endPlayerDrag();
    update(engine, input, 30);

    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
  });

  it('attempts the next queued turn immediately after a blocked step', () => {
    const { engine, input } = createHarness([
      '#####',
      '#@#E#',
      '#   #',
      '#####',
    ]);

    expect(input.queuePlayerStep('right')).toBe(true);
    expect(input.queuePlayerStep('down')).toBe(true);

    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });

    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 2 });
  });

  it('stops an in-progress route when the input bridge explicitly cancels it', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);
    input.queueTravelTarget({ x: 5, y: 1 });
    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    input.cancelTravel();
    const cancellationFrame = input.consumeFrame();
    expect(cancellationFrame.travelTarget).toBeNull();
    applyFrame(engine, cancellationFrame);
    update(engine, input, 24);

    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });
  });

  it('rejects a later tap route while the Pulse control remains held', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);
    input.queueTravelTarget({ x: 5, y: 1 });
    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    Reflect.set(input, 'beginActionHold', jest.fn());
    Reflect.get(input, 'pressActionSource').call(input, 'touch:pulse');

    const cancellationFrame = input.consumeFrame();
    expect(cancellationFrame.travelTarget).toBeNull();
    applyFrame(engine, cancellationFrame);

    input.queueTravelTarget({ x: 5, y: 1 });
    const blockedTapFrame = input.consumeFrame();
    expect(blockedTapFrame).not.toHaveProperty('travelTarget');
    applyFrame(engine, blockedTapFrame);
    update(engine, input, 24);

    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });
  });
});

import { GameEngine } from '../game/GameEngine';
import { Tile, type InputFrame, type LevelDefinition } from '../game/types';
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
    input: new InputManager({} as HTMLElement, callbacks),
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

  it('keeps moving under a stationary player hold and stops on release', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);
    input.setVirtualDirection('player-hold', 'right');
    update(engine, input, 13);

    expect(engine.getSnapshot().player).toEqual({ x: 4, y: 1 });

    input.setVirtualDirection('player-hold', null);
    update(engine, input, 24);
    expect(engine.getSnapshot().player).toEqual({ x: 4, y: 1 });
  });

  it('uses the latest finger direction without replaying a stale backlog', () => {
    const { engine, input } = createHarness([
      '#######',
      '#@    #',
      '#    E#',
      '#######',
    ]);

    input.setVirtualDirection('player-hold', 'right');
    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    input.setVirtualDirection('player-hold', 'left');
    input.setVirtualDirection('player-hold', 'up');
    input.setVirtualDirection('player-hold', 'down');
    update(engine, input, 7);

    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 2 });
  });

  it('does not move after a player hold is released during cooldown', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);

    input.setVirtualDirection('player-hold', 'right');
    update(engine, input);
    input.setVirtualDirection('player-hold', null);
    update(engine, input, 30);

    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });
  });

  it('never moves when the finger releases before the next engine tick', () => {
    const { engine, input } = createHarness(['########', '#@    E#', '########']);

    input.setVirtualDirection('player-hold', 'right');
    input.setVirtualDirection('player-hold', null);
    update(engine, input, 30);

    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
  });

  it('applies a new held direction immediately after a blocked attempt', () => {
    const { engine, input } = createHarness([
      '#####',
      '#@#E#',
      '#   #',
      '#####',
    ]);

    input.setVirtualDirection('player-hold', 'right');
    update(engine, input);
    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });

    input.setVirtualDirection('player-hold', 'down');
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

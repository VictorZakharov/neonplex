import { GameEngine } from './GameEngine';
import { Tile, type InputFrame, type LevelDefinition, type Point } from './types';

const IDLE: InputFrame = { direction: null, action: false, excavate: null };

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'tap-travel-test',
  name: 'Tap Travel Test',
  sector: 'TEST',
  briefing: 'Test fixture',
  parSeconds: 60,
  map,
});

const tick = (engine: GameEngine, frames = 1, input: InputFrame = IDLE): void => {
  for (let frame = 0; frame < frames; frame += 1) engine.update(1 / 60, input);
};

const requestTravel = (engine: GameEngine, target: Point): void => {
  tick(engine, 1, { ...IDLE, travelTarget: target });
};

describe('tap-to-travel', () => {
  it('travels horizontally through safe consumable cells and stops exactly at the target', () => {
    const engine = new GameEngine(
      definition(['########', '#@.ID E#', '########']),
      0,
    );
    engine.start();

    requestTravel(engine, { x: 5, y: 1 });
    tick(engine, 30);

    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({
        player: { x: 5, y: 1 },
        collected: 1,
        disks: 1,
        phase: 'playing',
      }),
    );
    expect(engine.tileAt(2, 1)).toBe(Tile.Empty);
    expect(engine.tileAt(3, 1)).toBe(Tile.Empty);
    expect(engine.tileAt(4, 1)).toBe(Tile.Empty);

    tick(engine, 30);
    expect(engine.getSnapshot().player).toEqual({ x: 5, y: 1 });
  });

  it('travels vertically using the same smooth movement cadence', () => {
    const engine = new GameEngine(
      definition(['#####', '#@  #', '#.  #', '#I  #', '#D E#', '#####']),
      0,
    );
    engine.start();

    requestTravel(engine, { x: 1, y: 4 });
    tick(engine, 24);

    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({
        player: { x: 1, y: 4 },
        collected: 1,
        disks: 1,
      }),
    );
  });

  it('allows a route to finish at an open exit', () => {
    const engine = new GameEngine(definition(['#####', '#@ E#', '#####']), 0);
    engine.start();

    requestTravel(engine, { x: 3, y: 1 });
    tick(engine, 12);

    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({ player: { x: 3, y: 1 }, phase: 'won' }),
    );
  });

  it.each([
    ['the current cell', { x: 1, y: 1 }],
    ['a diagonal cell', { x: 2, y: 2 }],
    ['a cell outside the level', { x: -1, y: 1 }],
    ['a closed exit', { x: 5, y: 1 }],
    ['a non-integral cell', { x: 2.5, y: 1 }],
  ] as const)('rejects %s as a route target', (_case, target) => {
    const engine = new GameEngine(
      definition(['#######', '#@  IE#', '#     #', '#######']),
      0,
    );
    engine.start();

    requestTravel(engine, target);

    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
  });

  it.each([
    ['a Zonk', 'O', Tile.Zonk],
    ['a Sentinel', 'S', Tile.Enemy],
    ['a Steel Bulkhead', '#', Tile.Steel],
    ['a Carbon Truss', 'X', Tile.Carbon],
    ['a Circuit Wall', 'W', Tile.Wall],
  ] as const)('does not enter or push %s on a requested route', (_case, symbol, tile) => {
    const engine = new GameEngine(
      definition(['########', `#@${symbol}  IE#`, '########']),
      0,
    );
    engine.start();

    requestTravel(engine, { x: 3, y: 1 });

    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
    expect(engine.tileAt(2, 1)).toBe(tile);
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it('does not cross a deployed Pulse Disk bomb', () => {
    const engine = new GameEngine(
      definition(['########', '#@D   E#', '#      #', '########']),
      0,
    );
    engine.start();

    tick(engine, 1, { ...IDLE, direction: 'right' });
    tick(engine, 6);
    tick(engine, 1, { ...IDLE, direction: 'right' });
    tick(engine, 6);
    tick(engine, 1, { ...IDLE, action: true });
    tick(engine, 1, { ...IDLE, direction: 'left' });
    tick(engine, 6);
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });
    expect(engine.tileAt(3, 1)).toBe(Tile.Bomb);

    requestTravel(engine, { x: 5, y: 1 });

    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });
  });

  it('stops when a falling object dynamically blocks the next route cell', () => {
    const engine = new GameEngine(
      definition(['########', '#   O E#', '#@     #', '########']),
      0,
    );
    engine.start();

    requestTravel(engine, { x: 6, y: 2 });
    tick(engine, 30);

    expect(engine.getSnapshot().player).toEqual({ x: 3, y: 2 });
    expect(engine.tileAt(4, 2)).toBe(Tile.Zonk);
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it.each([
    ['manual movement', { ...IDLE, direction: 'left' }],
    ['the deploy action', { ...IDLE, action: true }],
    ['remote excavation', { ...IDLE, excavate: 'up' }],
    ['an explicit cancellation', { ...IDLE, travelTarget: null }],
  ] as const)('cancels active travel with %s', (_case, cancellation) => {
    const engine = new GameEngine(definition(['########', '#@    E#', '########']), 0);
    engine.start();
    requestTravel(engine, { x: 5, y: 1 });
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    tick(engine, 1, cancellation);
    tick(engine, 30);

    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });
  });

  it('replaces an active route with a new valid target', () => {
    const engine = new GameEngine(definition(['########', '#@    E#', '########']), 0);
    engine.start();
    requestTravel(engine, { x: 5, y: 1 });
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    requestTravel(engine, { x: 1, y: 1 });
    tick(engine, 12);

    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
  });

  it('clears an active route when the game is paused or reset', () => {
    const engine = new GameEngine(definition(['########', '#@    E#', '########']), 0);
    engine.start();
    requestTravel(engine, { x: 5, y: 1 });
    engine.pause();
    engine.start();
    tick(engine, 30);
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 1 });

    requestTravel(engine, { x: 5, y: 1 });
    engine.reset();
    engine.start();
    tick(engine, 30);
    expect(engine.getSnapshot().player).toEqual({ x: 1, y: 1 });
  });
});

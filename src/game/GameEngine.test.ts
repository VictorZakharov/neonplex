import { GameEngine } from './GameEngine';
import { LEVELS } from './levels';
import { Tile, type Direction, type InputFrame, type LevelDefinition } from './types';

const IDLE: InputFrame = { direction: null, action: false, excavate: null };

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'test-grid',
  name: 'Test Grid',
  sector: 'TEST',
  briefing: 'Test fixture',
  parSeconds: 60,
  map,
});

const tick = (engine: GameEngine, frames = 1, input: InputFrame = IDLE): void => {
  for (let frame = 0; frame < frames; frame += 1) engine.update(1 / 60, input);
};

const move = (engine: GameEngine, direction: Direction): void => {
  tick(engine, 1, { direction, action: false, excavate: null });
  tick(engine, 7);
};

describe('GameEngine', () => {
  it('collects the objective, opens the exit, and completes a level', () => {
    const engine = new GameEngine(
      definition(['#######', '#@I.E##', '#######']),
      0,
    );
    engine.start();

    move(engine, 'right');
    expect(engine.getSnapshot().collected).toBe(1);
    expect(engine.tileAt(4, 1)).toBe(Tile.ExitOpen);

    move(engine, 'right');
    move(engine, 'right');
    expect(engine.getSnapshot().phase).toBe('won');
    expect(engine.getSnapshot().score).toBeGreaterThanOrEqual(2500);
    tick(engine, 6);
    expect(engine.getSnapshot().playerMotion).toBe(1);
  });

  it('chains held movement exactly when the previous full-cell animation completes', () => {
    const engine = new GameEngine(
      definition(['########', '#@   IE#', '########']),
      0,
    );
    engine.start();

    tick(engine, 1, { direction: 'right', action: false, excavate: null });
    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({
        previousPlayer: { x: 1, y: 1 },
        player: { x: 2, y: 1 },
        playerMotion: 0,
      }),
    );

    tick(engine, 5, { direction: 'right', action: false, excavate: null });
    expect(engine.getSnapshot().playerMotion).toBeCloseTo(5 / 6, 10);

    tick(engine, 1, { direction: 'right', action: false, excavate: null });
    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({
        previousPlayer: { x: 2, y: 1 },
        player: { x: 3, y: 1 },
        playerMotion: 0,
      }),
    );
  });

  it('publishes dirt consumption for the full linear player traversal', () => {
    const engine = new GameEngine(
      definition(['#####', '#@.E#', '#####']),
      0,
    );
    engine.start();

    tick(engine, 1, { direction: 'right', action: false, excavate: null });
    expect(engine.tileAt(2, 1)).toBe(Tile.Empty);
    expect(engine.getSnapshot().cellConsumptions).toEqual([
      {
        tile: Tile.Dirt,
        position: { x: 2, y: 1 },
        direction: 'right',
        kind: 'traverse',
        progress: 0,
        durationSeconds: 0.1,
      },
    ]);

    tick(engine, 3);
    expect(engine.getSnapshot().cellConsumptions[0]?.progress).toBeCloseTo(0.5, 10);

    tick(engine, 3);
    expect(engine.getSnapshot().cellConsumptions).toEqual([]);
  });

  it('excavates adjacent dirt remotely without moving and preserves overlapping vortex effects', () => {
    const engine = new GameEngine(
      definition(['#####', '#...#', '#.@.#', '#.E.#', '#####']),
      0,
    );
    engine.start();

    tick(engine, 1, { direction: null, action: false, excavate: 'right' });
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 2 });
    expect(engine.tileAt(3, 2)).toBe(Tile.Empty);
    expect(engine.getSnapshot().cellConsumptions).toEqual([
      expect.objectContaining({
        tile: Tile.Dirt,
        position: { x: 3, y: 2 },
        direction: 'right',
        kind: 'remote',
        progress: 0,
        durationSeconds: 0.3,
      }),
    ]);

    tick(engine, 1, { direction: null, action: false, excavate: 'up' });
    expect(engine.getSnapshot().player).toEqual({ x: 2, y: 2 });
    expect(engine.tileAt(2, 1)).toBe(Tile.Empty);
    expect(engine.getSnapshot().cellConsumptions).toHaveLength(2);
    expect(engine.consumeEvents().some((event) => event.type === 'move')).toBe(false);
  });

  it('chains falling stone cells without an animation dwell or progress reset in place', () => {
    const engine = new GameEngine(
      definition(['#######', '# O  E#', '#     #', '#     #', '#@    #', '#######']),
      0,
    );
    engine.start();

    tick(engine, 10);
    expect(engine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tile: Tile.Zonk,
          from: { x: 2, y: 1 },
          to: { x: 2, y: 2 },
          kind: 'fall',
          progress: 0,
          durationSeconds: 10 / 60,
        }),
      ]),
    );

    tick(engine, 9);
    expect(engine.getSnapshot().tileMotions[0]?.progress).toBeCloseTo(0.9, 10);

    tick(engine, 1);
    expect(engine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tile: Tile.Zonk,
          from: { x: 2, y: 2 },
          to: { x: 2, y: 3 },
          kind: 'fall',
          progress: 0,
        }),
      ]),
    );
  });

  it('rolls horizontally off a rounded support before beginning a vertical fall', () => {
    const engine = new GameEngine(
      definition(['#########', '##O    E#', '##W     #', '#@      #', '#########']),
      0,
    );
    engine.start();

    tick(engine, 10);
    expect(engine.tileAt(3, 1)).toBe(Tile.Zonk);
    expect(engine.tileAt(3, 2)).toBe(Tile.Empty);
    expect(engine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tile: Tile.Zonk,
          from: { x: 2, y: 1 },
          to: { x: 3, y: 1 },
          kind: 'roll',
          progress: 0,
        }),
      ]),
    );

    tick(engine, 10);
    expect(engine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tile: Tile.Zonk,
          from: { x: 3, y: 1 },
          to: { x: 3, y: 2 },
          kind: 'fall',
          progress: 0,
        }),
      ]),
    );
  });

  it.each([
    ['the Carrier', ['########', '##O@  E#', '##W    #', '#      #', '########']],
    ['another object', ['########', '##OW  E#', '##W    #', '#@     #', '########']],
  ] as const)('does not roll when %s occupies the sideways destination', (_blocker, map) => {
    const engine = new GameEngine(definition(map), 0);
    engine.start();
    tick(engine, 10);

    expect(engine.tileAt(2, 1)).toBe(Tile.Zonk);
    expect(engine.getSnapshot().tileMotions.some((motion) => motion.tile === Tile.Zonk)).toBe(false);
  });

  it('does not roll when the Carrier occupies the diagonal fall cell', () => {
    const engine = new GameEngine(
      definition(['########', '##O   E#', '##W@   #', '#      #', '########']),
      0,
    );
    engine.start();
    tick(engine, 10);

    expect(engine.tileAt(2, 1)).toBe(Tile.Zonk);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().tileMotions.some((motion) => motion.tile === Tile.Zonk)).toBe(false);
  });

  it.each([
    ['Steel Bulkhead', '###    #'],
    ['Carbon Truss', '##X    #'],
  ] as const)('does not roll off a square %s', (_support, supportRow) => {
    const engine = new GameEngine(
      definition(['########', '# O   E#', supportRow, '#@     #', '########']),
      0,
    );
    engine.start();
    tick(engine, 10);

    expect(engine.tileAt(2, 1)).toBe(Tile.Zonk);
    expect(engine.getSnapshot().tileMotions.some((motion) => motion.tile === Tile.Zonk)).toBe(false);
  });

  it('does not kill the player beneath a stationary Zonk', () => {
    const engine = new GameEngine(
      definition(['#####', '# OI#', '# @E#', '#####']),
      0,
    );
    engine.start();
    tick(engine, 36);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.consumeEvents().some((event) => event.type === 'death')).toBe(false);
  });

  it('kills the player only after a Zonk has entered the falling state', () => {
    const engine = new GameEngine(
      definition(['#######', '# OI E#', '#     #', '#@    #', '#######']),
      0,
    );
    engine.start();
    tick(engine, 12);
    expect(engine.getSnapshot().tileMotions.some((motion) => motion.tile === Tile.Zonk)).toBe(true);
    move(engine, 'right');
    tick(engine, 3);
    expect(engine.getSnapshot().phase).toBe('lost');
    expect(engine.tileAt(2, 3)).toBe(Tile.Explosion);
    const events = engine.consumeEvents();
    expect(events.some((event) => event.type === 'death')).toBe(true);
    expect(events.some((event) => event.type === 'explode')).toBe(true);
  });

  it('publishes interpolated motion records for pushed Zonks and moving Sentinels', () => {
    const pushEngine = new GameEngine(
      definition(['#######', '#@O IE#', '#######']),
      0,
    );
    pushEngine.start();
    tick(pushEngine, 1, { direction: 'right', action: false, excavate: null });
    expect(pushEngine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tile: Tile.Zonk, kind: 'push', progress: 0 }),
      ]),
    );

    const enemyEngine = new GameEngine(
      definition(['########', '#@ S IE#', '########']),
      0,
    );
    enemyEngine.start();
    tick(enemyEngine, 15);
    expect(enemyEngine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([expect.objectContaining({ tile: Tile.Enemy, kind: 'enemy' })]),
    );
  });

  it('rotates a Sentinel in place before moving in a new direction', () => {
    const engine = new GameEngine(
      definition(['#######', '#@S# E#', '#     #', '#######']),
      0,
    );
    engine.start();

    tick(engine, 13);
    expect(engine.tileAt(2, 1)).toBe(Tile.Enemy);
    expect(engine.getSnapshot().tileMotions).toHaveLength(0);
    expect(engine.getSnapshot().enemies).toEqual([
      expect.objectContaining({
        position: { x: 2, y: 1 },
        facing: 'down',
        turnFrom: 'right',
        turnProgress: 0,
      }),
    ]);

    tick(engine, 12);
    expect(engine.getSnapshot().enemies[0]?.turnProgress).toBeCloseTo(12 / 13, 10);
    expect(engine.tileAt(2, 1)).toBe(Tile.Enemy);

    tick(engine, 1);
    expect(engine.tileAt(2, 2)).toBe(Tile.Enemy);
    expect(engine.getSnapshot().tileMotions).toEqual(
      expect.arrayContaining([expect.objectContaining({ tile: Tile.Enemy, kind: 'enemy' })]),
    );
  });

  it('does not let a turning Sentinel kill until its later translation begins', () => {
    const engine = new GameEngine(
      definition(['#####', '# S##', '# @E#', '#####']),
      0,
    );
    engine.start();

    tick(engine, 13);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().enemies[0]).toEqual(
      expect.objectContaining({ facing: 'down', turnFrom: 'right' }),
    );

    tick(engine, 12);
    expect(engine.getSnapshot().phase).toBe('playing');
    tick(engine, 1);
    expect(engine.getSnapshot().phase).toBe('lost');
  });

  it('creates the same 3x3 death explosion when a Sentinel kills the player', () => {
    const engine = new GameEngine(
      definition(['#######', '#@S IE#', '#     #', '#######']),
      0,
    );
    engine.start();
    tick(engine, 1, { direction: 'right', action: false, excavate: null });

    expect(engine.getSnapshot().phase).toBe('lost');
    expect(engine.tileAt(2, 1)).toBe(Tile.Explosion);
    expect(engine.tileAt(1, 2)).toBe(Tile.Explosion);
    expect(engine.tileAt(0, 1)).toBe(Tile.Steel);
  });

  it('deploys a Pulse Disk and destroys a destructible wall without touching steel', () => {
    const engine = new GameEngine(
      definition(['#########', '#@D  WIE#', '#########']),
      0,
    );
    engine.start();
    move(engine, 'right');
    move(engine, 'right');
    move(engine, 'right');
    tick(engine, 1, { direction: null, action: true, excavate: null });
    move(engine, 'left');
    move(engine, 'left');
    tick(engine, 55);

    expect(engine.tileAt(5, 1)).not.toBe(Tile.Wall);
    expect(engine.tileAt(0, 0)).toBe(Tile.Steel);
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it('keeps a Carbon Truss intact inside a Pulse Disk blast', () => {
    const engine = new GameEngine(
      definition(['##########', '#@D  X IE#', '##########']),
      0,
    );
    engine.start();
    move(engine, 'right');
    move(engine, 'right');
    move(engine, 'right');
    tick(engine, 1, { direction: null, action: true, excavate: null });
    move(engine, 'left');
    move(engine, 'left');
    tick(engine, 55);

    expect(engine.tileAt(5, 1)).toBe(Tile.Carbon);
  });

  it('deploys a Pulse Disk beneath the Carrier rather than in the facing cell', () => {
    const engine = new GameEngine(
      definition(['########', '#@D   E#', '########']),
      0,
    );
    engine.start();
    move(engine, 'right');
    move(engine, 'right');

    expect(engine.getSnapshot().player).toEqual({ x: 3, y: 1 });
    tick(engine, 1, { direction: null, action: true, excavate: null });

    expect(engine.tileAt(3, 1)).toBe(Tile.Bomb);
    expect(engine.tileAt(4, 1)).toBe(Tile.Empty);
  });

  it('resets every mutable system to the original deterministic state', () => {
    const level = definition(['#######', '#@I.E##', '#######']);
    const engine = new GameEngine(level, 0);
    engine.start();
    move(engine, 'right');
    engine.reset();

    const fresh = new GameEngine(level, 0).getSnapshot();
    const reset = engine.getSnapshot();
    expect(reset.tiles).toEqual(fresh.tiles);
    expect(reset.player).toEqual(fresh.player);
    expect(reset.tick).toBe(0);
    expect(reset.phase).toBe('ready');
    expect(reset.collected).toBe(0);
  });

  it('opens an exit immediately when a level has no extraction objective', () => {
    const engine = new GameEngine(definition(['#####', '#@ E#', '#####']), 0);
    expect(engine.tileAt(3, 1)).toBe(Tile.ExitOpen);
  });

  it('rejects malformed level boundaries', () => {
    expect(() => new GameEngine(definition(['#####', '#@E#', '####']), 0)).toThrow(/rectangular/);
    expect(() => new GameEngine(definition(['#####', '#@@E#', '#####']), 0)).toThrow(/spawn/);
    expect(() => new GameEngine(definition(['#####', '#@?E#', '#####']), 0)).toThrow(/unknown tile/);
  });
});

describe('campaign data', () => {
  it('loads every level as a valid rectangular simulation', () => {
    for (const [index, level] of LEVELS.entries()) {
      const width = level.map[0]?.length ?? 0;
      expect(level.map.every((row) => row.length === width)).toBe(true);
      expect(() => new GameEngine(level, index)).not.toThrow();
    }
  });

  it('contains distinct large-map topologies for scrolling sectors', () => {
    const dimensions = LEVELS.map((level) => `${level.map[0]?.length ?? 0}x${level.map.length}`);
    expect(new Set(dimensions).size).toBe(LEVELS.length);
    expect((LEVELS[1]?.map[0]?.length ?? 0) * (LEVELS[1]?.map.length ?? 0)).toBeGreaterThan(800);
    expect((LEVELS[2]?.map[0]?.length ?? 0) * (LEVELS[2]?.map.length ?? 0)).toBeGreaterThan(1100);
  });

  it('keeps every objective broadly connected when destructible walls are treated as passable', () => {
    for (const level of LEVELS) {
      const width = level.map[0]?.length ?? 0;
      const spawnIndex = level.map.join('').indexOf('@');
      const queue = [spawnIndex];
      const visited = new Set<number>(queue);
      while (queue.length > 0) {
        const index = queue.shift();
        if (index === undefined) break;
        const x = index % width;
        const y = Math.floor(index / width);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= level.map.length) continue;
          const next = ny * width + nx;
          const symbol = level.map[ny]?.[nx];
          if (symbol === '#' || symbol === 'X' || visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
      level.map.forEach((row, y) => {
        [...row].forEach((symbol, x) => {
          if (symbol === 'I' || symbol === 'E' || symbol === 'D') {
            expect(visited.has(y * width + x)).toBe(true);
          }
        });
      });
    }
  });
});

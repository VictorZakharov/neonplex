import { GameEngine } from './GameEngine';
import { LEVELS } from './levels';
import { Tile, type InputFrame, type LevelDefinition } from './types';

const IDLE: InputFrame = { direction: null, action: false, excavate: null };

const tick = (engine: GameEngine, frames: number, input: InputFrame = IDLE): void => {
  for (let frame = 0; frame < frames; frame += 1) engine.update(1 / 60, input);
};

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'patrol-test',
  name: 'Patrol Test',
  sector: 'TEST',
  briefing: 'Test fixture',
  parSeconds: 60,
  map,
});

const NEIGHBOR_OFFSETS = [-1, 0, 1].flatMap((y) =>
  [-1, 0, 1]
    .filter((x) => x !== 0 || y !== 0)
    .map((x) => ({ x, y })),
);

const hasLiveWallContact = (engine: GameEngine, x: number, y: number): boolean =>
  NEIGHBOR_OFFSETS.some(({ x: offsetX, y: offsetY }) => {
    const tile = engine.tileAt(x + offsetX, y + offsetY);
    return tile !== Tile.Empty && tile !== Tile.Enemy && tile !== Tile.Explosion;
  });

describe('Sentinel patrols', () => {
  it('starts every Circuit Warren Sentinel on its chamber wall circuit', () => {
    const level = LEVELS[1];
    if (level === undefined) throw new Error('Circuit Warren fixture is missing.');
    const engine = new GameEngine(level, 1);
    engine.start();

    const starts = [{ x: 30, y: 7 }, { x: 23, y: 17 }, { x: 6, y: 18 }];
    expect(engine.getSnapshot().enemies.map((enemy) => enemy.position)).toEqual(starts);

    tick(engine, 52);

    const positions = engine.getSnapshot().enemies.map((enemy) => enemy.position);
    expect(positions).toHaveLength(starts.length);
    positions.forEach((position, index) => {
      const start = starts[index];
      if (start === undefined) throw new Error('Sentinel start fixture is missing.');
      expect(position).not.toEqual(start);
    });
  });

  it('hugs its current visible wall boundary rather than a stored coordinate circuit', () => {
    const engine = new GameEngine(
      definition(['###########', '###      E#', '#@.      ##', '###  S    #', '###########']),
      0,
    );
    engine.start();
    const visited = new Set<string>();

    for (let frame = 0; frame < 520; frame += 1) {
      tick(engine, 1);
      const enemy = engine.getSnapshot().enemies[0];
      expect(enemy).toBeDefined();
      if (enemy === undefined) continue;
      const key = `${enemy.position.x},${enemy.position.y}`;
      expect(hasLiveWallContact(engine, enemy.position.x, enemy.position.y)).toBe(true);
      expect(engine.tileAt(enemy.position.x, enemy.position.y)).toBe(Tile.Enemy);
      visited.add(key);
    }

    expect(engine.getSnapshot().phase).toBe('playing');
    expect(visited.size).toBeGreaterThanOrEqual(12);
  });

  it('turns through a newly excavated opening in its live wall geometry', () => {
    const engine = new GameEngine(
      definition([
        '###########',
        '#        E#',
        '#  S      #',
        '#WW.WWWWWW#',
        '# W@      #',
        '# W       #',
        '# W       #',
        '###########',
      ]),
      0,
    );
    engine.start();

    tick(engine, 1, { direction: null, action: false, excavate: 'up' });
    expect(engine.tileAt(3, 3)).toBe(Tile.Empty);
    tick(engine, 1, { direction: 'right', action: false, excavate: null });
    tick(engine, 11);
    expect(engine.getSnapshot().enemies[0]).toEqual(
      expect.objectContaining({ position: { x: 3, y: 2 }, facing: 'down', turnFrom: 'right' }),
    );

    tick(engine, 13);
    expect(engine.getSnapshot().enemies[0]?.position).toEqual({ x: 3, y: 3 });
    expect(hasLiveWallContact(engine, 3, 3)).toBe(true);
    tick(engine, 13);
    expect(engine.getSnapshot().enemies[0]?.position).toEqual({ x: 3, y: 4 });
    expect(hasLiveWallContact(engine, 3, 4)).toBe(true);
    tick(engine, 13);
    expect(engine.getSnapshot().enemies[0]?.position).toEqual({ x: 3, y: 5 });
    expect(hasLiveWallContact(engine, 3, 5)).toBe(true);
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it('does not orbit through open space without live wall contact', () => {
    const engine = new GameEngine(
      definition([
        '###########',
        '#@       E#',
        '#         #',
        '#         #',
        '#    S    #',
        '#         #',
        '#         #',
        '#         #',
        '###########',
      ]),
      0,
    );
    engine.start();

    tick(engine, 260);

    expect(engine.getSnapshot().enemies[0]).toEqual(
      expect.objectContaining({ position: { x: 5, y: 4 }, facing: 'right', turnFrom: null }),
    );
  });

  it('recomputes live support when geometry changes during a turn', () => {
    const engine = new GameEngine(
      definition([
        '#########',
        '#      E#',
        '#   S   #',
        '#  .    #',
        '#  @    #',
        '#########',
      ]),
      0,
    );
    engine.start();

    tick(engine, 13);
    expect(engine.getSnapshot().enemies[0]).toEqual(
      expect.objectContaining({ position: { x: 4, y: 2 }, facing: 'down', turnFrom: 'right' }),
    );
    tick(engine, 1, { direction: null, action: false, excavate: 'up' });
    expect(engine.tileAt(3, 3)).toBe(Tile.Empty);
    tick(engine, 12);

    expect(engine.getSnapshot().enemies[0]).toEqual(
      expect.objectContaining({ position: { x: 4, y: 2 } }),
    );
    expect(engine.getSnapshot().tileMotions).toHaveLength(0);
  });
});

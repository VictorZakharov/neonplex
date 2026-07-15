import { GameEngine } from './GameEngine';
import { Tile, type InputFrame, type LevelDefinition } from './types';

const IDLE: InputFrame = { direction: null, action: false, excavate: null };

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'push-motion-test',
  name: 'Push Motion Test',
  sector: 'TEST',
  briefing: 'Test fixture',
  parSeconds: 60,
  map,
});

const tick = (engine: GameEngine, frames: number, input: InputFrame = IDLE): void => {
  for (let frame = 0; frame < frames; frame += 1) engine.update(1 / 60, input);
};

describe('pushed Zonk motion', () => {
  it('finishes its linear horizontal tween before gravity can begin a fall', () => {
    const engine = new GameEngine(
      definition(['########', '#@O   E#', '# W    #', '########']),
      0,
    );
    engine.start();
    tick(engine, 9);

    tick(engine, 1, { direction: 'right', action: false, excavate: null });

    expect(engine.tileAt(3, 1)).toBe(Tile.Zonk);
    expect(engine.tileAt(3, 2)).toBe(Tile.Empty);
    expect(engine.getSnapshot().tileMotions).toEqual([
      expect.objectContaining({
        tile: Tile.Zonk,
        kind: 'push',
        from: { x: 2, y: 1 },
        to: { x: 3, y: 1 },
        progress: 0,
      }),
    ]);

    tick(engine, 3);
    expect(engine.getSnapshot().tileMotions[0]?.progress).toBeCloseTo(0.5, 10);
    tick(engine, 3);
    expect(engine.getSnapshot().tileMotions).toHaveLength(0);

    tick(engine, 4);
    expect(engine.tileAt(3, 2)).toBe(Tile.Zonk);
    expect(engine.getSnapshot().tileMotions).toEqual([
      expect.objectContaining({ tile: Tile.Zonk, kind: 'fall' }),
    ]);
  });
});

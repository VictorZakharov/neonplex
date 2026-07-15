import { GameEngine } from './GameEngine';
import { Tile, type InputFrame, type LevelDefinition } from './types';

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'remote-consumption-test',
  name: 'Remote Consumption Test',
  sector: 'TEST',
  briefing: 'Test fixture',
  parSeconds: 60,
  map,
});

const tick = (engine: GameEngine, frames: number, input: InputFrame): void => {
  for (let frame = 0; frame < frames; frame += 1) engine.update(1 / 60, input);
};

describe('remote cell consumption', () => {
  it('collects an adjacent Infotron without moving the Carrier', () => {
    const engine = new GameEngine(definition(['#####', '#@IE#', '#####']), 0);
    engine.start();

    tick(engine, 1, { direction: null, action: false, excavate: 'right' });

    const snapshot = engine.getSnapshot();
    expect(snapshot.player).toEqual({ x: 1, y: 1 });
    expect(snapshot.collected).toBe(1);
    expect(snapshot.score).toBe(500);
    expect(engine.tileAt(2, 1)).toBe(Tile.Empty);
    expect(engine.tileAt(3, 1)).toBe(Tile.ExitOpen);
    expect(snapshot.cellConsumptions).toEqual([
      expect.objectContaining({
        tile: Tile.Infotron,
        position: { x: 2, y: 1 },
        direction: 'right',
        kind: 'remote',
        progress: 0,
      }),
    ]);
    const events = engine.consumeEvents();
    expect(events.some((event) => event.type === 'collect')).toBe(true);
    expect(events.some((event) => event.type === 'exit-open')).toBe(true);
    expect(events.some((event) => event.type === 'move' || event.type === 'dig')).toBe(false);
  });

  it('collects an adjacent Pulse Disk without moving the Carrier', () => {
    const engine = new GameEngine(definition(['#####', '#@DE#', '#####']), 0);
    engine.start();

    tick(engine, 1, { direction: null, action: false, excavate: 'right' });

    const snapshot = engine.getSnapshot();
    expect(snapshot.player).toEqual({ x: 1, y: 1 });
    expect(snapshot.disks).toBe(1);
    expect(snapshot.score).toBe(250);
    expect(engine.tileAt(2, 1)).toBe(Tile.Empty);
    expect(snapshot.cellConsumptions).toEqual([
      expect.objectContaining({
        tile: Tile.Disk,
        position: { x: 2, y: 1 },
        direction: 'right',
        kind: 'remote',
        progress: 0,
      }),
    ]);
    const events = engine.consumeEvents();
    expect(events.some((event) => event.type === 'disk-pickup')).toBe(true);
    expect(events.some((event) => event.type === 'move' || event.type === 'dig')).toBe(false);
  });
});

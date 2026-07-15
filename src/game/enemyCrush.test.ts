import { GameEngine } from './GameEngine';
import { Tile, type InputFrame, type LevelDefinition } from './types';

const IDLE: InputFrame = { direction: null, action: false, excavate: null };

const definition = (map: readonly string[]): LevelDefinition => ({
  id: 'enemy-crush-test',
  name: 'Enemy Crush Test',
  sector: 'TEST',
  briefing: 'Test fixture',
  parSeconds: 60,
  map,
});

const tick = (engine: GameEngine, frames: number): void => {
  for (let frame = 0; frame < frames; frame += 1) engine.update(1 / 60, IDLE);
};

describe('falling objects crushing Sentinels', () => {
  it.each([
    ['Zonk', 'O'],
    ['Infotron', 'I'],
  ] as const)('detonates a 3x3 explosion when a falling %s lands on a Sentinel', (_name, symbol) => {
    const engine = new GameEngine(
      definition(['#######', `# ${symbol} @E#`, '#     #', '##S####', '#######']),
      0,
    );
    engine.start();

    tick(engine, 20);

    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().enemies).toHaveLength(0);
    expect(engine.tileAt(2, 2)).toBe(Tile.Explosion);
    expect(engine.tileAt(2, 3)).toBe(Tile.Explosion);
    const events = engine.consumeEvents();
    expect(events.some((event) => event.type === 'explode')).toBe(true);
    expect(events.some((event) => event.type === 'death')).toBe(false);
  });

  it('does not detonate an object that is stationary directly above a Sentinel', () => {
    const engine = new GameEngine(
      definition(['#######', '#   @E#', '##O####', '##S####', '#######']),
      0,
    );
    engine.start();

    tick(engine, 30);

    expect(engine.tileAt(2, 2)).toBe(Tile.Zonk);
    expect(engine.tileAt(2, 3)).toBe(Tile.Enemy);
    expect(engine.consumeEvents().some((event) => event.type === 'explode')).toBe(false);
  });
});

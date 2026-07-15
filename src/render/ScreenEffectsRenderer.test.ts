import type { GameEvent } from '../game/types';
import { ScreenEffectsRenderer } from './ScreenEffectsRenderer';

const LAYOUT = { tile: 32, left: 0, top: 0, width: 320, height: 180 };

const createRenderer = (): ScreenEffectsRenderer =>
  new ScreenEffectsRenderer({ matches: false } as MediaQueryList);

const createContext = () => {
  const arc = jest.fn();
  const context = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    arc,
    fill: jest.fn(),
  } as unknown as CanvasRenderingContext2D;
  return { arc, context };
};

const event = (type: GameEvent['type']): GameEvent => ({
  type,
  position: { x: 2, y: 2 },
});

describe('ScreenEffectsRenderer movement feedback', () => {
  it.each(['dig', 'push'] as const)('does not draw a dot puff for %s events', (type) => {
    const renderer = createRenderer();
    const { arc, context } = createContext();

    renderer.update(0, [event(type)]);
    renderer.drawParticles(context, LAYOUT);

    expect(arc).not.toHaveBeenCalled();
  });

  it('retains particles for object impacts', () => {
    const renderer = createRenderer();
    const { arc, context } = createContext();

    renderer.update(0, [event('impact')]);
    renderer.drawParticles(context, LAYOUT);

    expect(arc).toHaveBeenCalled();
  });
});

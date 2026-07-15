import { Tile } from '../../game/types';
import { StaticTilePainter } from './StaticTilePainter';

const fakeContext = (): CanvasRenderingContext2D => {
  const methods: Record<PropertyKey, unknown> = {
    createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
    createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  };
  return new Proxy(methods, {
    get: (target, property) => {
      if (!(property in target)) target[property] = jest.fn();
      return target[property];
    },
    set: (target, property, value) => {
      target[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

describe('StaticTilePainter', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

  afterEach(() => {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, 'document');
    } else {
      Object.defineProperty(globalThis, 'document', originalDocument);
    }
  });

  it('reuses one stable raster per tile across animated zoom sizes', () => {
    const cacheContext = fakeContext();
    const createElement = jest.fn(() => ({
      width: 0,
      height: 0,
      getContext: jest.fn(() => cacheContext),
    }));
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement },
    });
    const output = fakeContext();
    const painter = new StaticTilePainter();

    painter.setDevicePixelRatio(2);
    painter.drawStaticTile(output, Tile.Steel, 0, 0, 32);
    painter.drawStaticTile(output, Tile.Steel, 0, 0, 92);

    expect(createElement).toHaveBeenCalledTimes(1);

    painter.drawStaticTile(output, Tile.Wall, 0, 0, 92);
    expect(createElement).toHaveBeenCalledTimes(2);

    painter.setDevicePixelRatio(1);
    painter.drawStaticTile(output, Tile.Steel, 0, 0, 92);
    expect(createElement).toHaveBeenCalledTimes(3);
  });
});

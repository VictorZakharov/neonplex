import type { GameSnapshot } from '../game/types';
import { CameraController } from './CameraController';
import type { CameraInteractionCallbacks, Viewport } from './renderTypes';

class FakeCameraCanvas extends EventTarget {
  public readonly captures = new Set<number>();
  public readonly dataset: Record<string, string> = {};
  public left = 0;
  public top = 0;
  public width = 400;
  public height = 300;
  public measurements = 0;

  public getBoundingClientRect(): DOMRect {
    this.measurements += 1;
    return {
      bottom: this.top + this.height,
      height: this.height,
      left: this.left,
      right: this.left + this.width,
      top: this.top,
      width: this.width,
      x: this.left,
      y: this.top,
      toJSON: () => ({}),
    };
  }

  public setPointerCapture(pointerId: number): void {
    this.captures.add(pointerId);
  }

  public hasPointerCapture(pointerId: number): boolean {
    return this.captures.has(pointerId);
  }

  public releasePointerCapture(pointerId: number): void {
    this.captures.delete(pointerId);
  }
}

class FakeCameraDocument extends EventTarget {
  public hidden = false;
}

const pointerEvent = (
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType: 'mouse' | 'touch' = 'mouse',
): PointerEvent => {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  return event as PointerEvent;
};

const SNAPSHOT: GameSnapshot = {
  width: 100,
  height: 100,
  tiles: [],
  tileMotions: [],
  player: { x: 50, y: 50 },
  previousPlayer: { x: 50, y: 50 },
  playerMotion: 1,
  playerMotionDurationSeconds: 0.1,
  cellConsumptions: [],
  enemies: [],
  facing: 'right',
  collected: 0,
  required: 0,
  disks: 0,
  score: 0,
  elapsedSeconds: 0,
  phase: 'playing',
  levelIndex: 0,
  levelName: 'Resize fixture',
  tick: 0,
  gravityProgress: 0,
};

describe('CameraController viewport gesture integration', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let canvas: FakeCameraCanvas;
  let camera: CameraController;
  let interactions: CameraInteractionCallbacks;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: new EventTarget(),
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeCameraDocument(),
    });
    canvas = new FakeCameraCanvas();
    interactions = { onPlayerDirection: jest.fn() };
    camera = new CameraController(
      canvas as unknown as HTMLCanvasElement,
      [],
      { matches: true } as unknown as MediaQueryList,
      interactions,
    );
  });

  afterEach(() => {
    camera.dispose();
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      Object.defineProperty(globalThis, 'window', originalWindow);
    }
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, 'document');
    } else {
      Object.defineProperty(globalThis, 'document', originalDocument);
    }
  });

  it('refreshes gesture geometry when viewport dimensions are unchanged', () => {
    const viewport = { width: 400, height: 300 };
    camera.handleViewportResize(viewport);
    expect(canvas.measurements).toBe(1);

    canvas.left = 24;
    camera.handleViewportResize(viewport);

    expect(canvas.measurements).toBe(2);
  });

  it('rebases an active pan to the camera position preserved by resize', () => {
    let viewport: Viewport = { width: 400, height: 300 };
    camera.handleViewportResize(viewport);
    camera.layoutFor(SNAPSHOT, 0, 0, viewport);

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 40, 50));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 70, 50));

    canvas.width = 500;
    viewport = { width: 500, height: 300 };
    camera.handleViewportResize(viewport);
    camera.layoutFor(SNAPSHOT, 0, 0, viewport);
    const preservedLeft = Reflect.get(camera, 'cameraLeft') as number;

    canvas.dispatchEvent(pointerEvent('pointermove', 1, 80, 50));

    expect(Reflect.get(camera, 'cameraLeft')).toBeCloseTo(preservedLeft + 10, 10);
    expect(canvas.captures.has(1)).toBe(true);
  });

  it('re-evaluates a stationary held finger after the player anchor moves', () => {
    const viewport = { width: 400, height: 300 };
    const initial = {
      ...SNAPSHOT,
      width: 5,
      height: 3,
      player: { x: 1, y: 1 },
      previousPlayer: { x: 1, y: 1 },
    };
    camera.handleViewportResize(viewport);
    camera.layoutFor(initial, 0, 0, viewport);
    const anchor = camera.getPlayerScreenAnchor();
    expect(anchor).not.toBeNull();
    if (anchor === null) return;

    canvas.dispatchEvent(pointerEvent('pointerdown', 2, anchor.x, anchor.y, 'touch'));
    canvas.dispatchEvent(
      pointerEvent('pointermove', 2, anchor.x + 40, anchor.y, 'touch'),
    );
    expect(interactions.onPlayerDirection).toHaveBeenLastCalledWith('right');

    camera.layoutFor(
      {
        ...initial,
        player: { x: 2, y: 1 },
        previousPlayer: { x: 2, y: 1 },
      },
      0,
      0,
      viewport,
    );

    expect(interactions.onPlayerDirection).toHaveBeenLastCalledWith(null);
  });

  it('cancels an active player hold before a modal can clear input state', () => {
    const viewport = { width: 400, height: 300 };
    camera.handleViewportResize(viewport);
    camera.layoutFor(SNAPSHOT, 0, 0, viewport);
    const anchor = camera.getPlayerScreenAnchor();
    expect(anchor).not.toBeNull();
    if (anchor === null) return;

    canvas.dispatchEvent(pointerEvent('pointerdown', 3, anchor.x, anchor.y, 'touch'));
    canvas.dispatchEvent(
      pointerEvent('pointermove', 3, anchor.x + 40, anchor.y, 'touch'),
    );
    expect(interactions.onPlayerDirection).toHaveBeenLastCalledWith('right');

    camera.cancelInteractions();

    expect(interactions.onPlayerDirection).toHaveBeenLastCalledWith(null);
    expect(canvas.captures.has(3)).toBe(false);

    canvas.dispatchEvent(pointerEvent('pointerdown', 4, anchor.x, anchor.y, 'touch'));
    canvas.dispatchEvent(
      pointerEvent('pointermove', 4, anchor.x + 40, anchor.y, 'touch'),
    );
    expect(interactions.onPlayerDirection).toHaveBeenLastCalledWith('right');
  });
});

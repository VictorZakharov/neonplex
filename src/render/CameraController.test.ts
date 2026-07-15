import type { GameSnapshot } from '../game/types';
import { CameraController } from './CameraController';
import type { Viewport } from './renderTypes';

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
): PointerEvent => {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    pointerType: { value: 'mouse' },
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
    camera = new CameraController(
      canvas as unknown as HTMLCanvasElement,
      [],
      { matches: true } as unknown as MediaQueryList,
      {},
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
});

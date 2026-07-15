import type { Direction } from '../game/types';
import { CanvasGestureController } from './CanvasGestureController';
import type {
  CameraInteractionCallbacks,
  CanvasGestureHost,
  PinchGestureUpdate,
  ScreenPoint,
  Viewport,
} from './renderTypes';

class FakeCanvas extends EventTarget {
  public readonly captures = new Set<number>();
  public readonly dataset: Record<string, string> = {};
  public left = 0;
  public top = 0;
  public width = 400;
  public height = 300;

  public getBoundingClientRect(): DOMRect {
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

class FakeDocument extends EventTarget {
  public hidden = false;
}

const pointerEvent = (
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType: 'mouse' | 'touch' = 'touch',
  button = 0,
): PointerEvent => {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: button },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  return event as PointerEvent;
};

describe('CanvasGestureController', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let fakeWindow: EventTarget;
  let fakeDocument: FakeDocument;
  let canvas: FakeCanvas;
  let viewport: Viewport;
  let beginPan: jest.Mock<void, []>;
  let panBy: jest.Mock<void, [ScreenPoint]>;
  let applyPinch: jest.Mock<void, [PinchGestureUpdate]>;
  let dispatchTap: jest.Mock<void, [ScreenPoint]>;
  let zoomFromWheel: jest.Mock<void, [boolean, ScreenPoint]>;
  let onPlayerDirection: jest.Mock<void, [Direction | null]>;
  let onCancelTravel: jest.Mock<void, []>;
  let onUserGesture: jest.Mock<void, []>;
  let playerAnchor: { x: number; y: number; tileSize: number };
  let controller: CanvasGestureController;

  beforeEach(() => {
    fakeWindow = new EventTarget();
    fakeDocument = new FakeDocument();
    canvas = new FakeCanvas();
    viewport = { width: 400, height: 300 };
    beginPan = jest.fn();
    panBy = jest.fn();
    applyPinch = jest.fn();
    dispatchTap = jest.fn();
    zoomFromWheel = jest.fn();
    onPlayerDirection = jest.fn();
    onCancelTravel = jest.fn();
    onUserGesture = jest.fn();
    playerAnchor = { x: 100, y: 100, tileSize: 30 };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: fakeWindow,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument,
    });

    const host: CanvasGestureHost = {
      getViewport: () => viewport,
      getPlayerScreenAnchor: () => playerAnchor,
      beginPan,
      panBy,
      applyPinch,
      dispatchTap,
      zoomFromWheel,
    };
    const interactions: CameraInteractionCallbacks = {
      onPlayerDirection,
      onCancelTravel,
      onUserGesture,
    };
    controller = new CanvasGestureController(
      canvas as unknown as HTMLCanvasElement,
      host,
      interactions,
    );
  });

  afterEach(() => {
    controller.dispose();
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

  it('dispatches a stationary tap but suppresses it after crossing the pan threshold', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 220, 180));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 220, 180));

    expect(dispatchTap).toHaveBeenCalledWith({ x: 220, y: 180 });
    expect(beginPan).not.toHaveBeenCalled();

    dispatchTap.mockClear();
    canvas.dispatchEvent(pointerEvent('pointerdown', 2, 220, 180));
    canvas.dispatchEvent(pointerEvent('pointermove', 2, 231, 180));
    canvas.dispatchEvent(pointerEvent('pointerup', 2, 231, 180));

    expect(beginPan).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenCalledWith({ x: 11, y: 0 });
    expect(dispatchTap).not.toHaveBeenCalled();
  });

  it('rebases an active touch pan when canvas geometry changes at the same viewport size', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 20, 220, 180));
    canvas.dispatchEvent(pointerEvent('pointermove', 20, 240, 180));
    expect(beginPan).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenLastCalledWith({ x: 20, y: 0 });

    canvas.left = 20;
    controller.handleViewportResize();
    expect(beginPan).toHaveBeenCalledTimes(2);

    panBy.mockClear();
    canvas.dispatchEvent(pointerEvent('pointermove', 20, 250, 180));
    expect(panBy).toHaveBeenCalledWith({ x: 10, y: 0 });
    expect(canvas.captures.has(20)).toBe(true);
  });

  it('holds one direction while the finger is stationary and clears it on release', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 3, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 3, 140, 100));

    expect(onPlayerDirection).toHaveBeenCalledWith('right');
    expect(canvas.captures.has(3)).toBe(true);

    controller.updatePlayerHold();
    controller.updatePlayerHold();
    expect(onPlayerDirection).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(pointerEvent('pointerup', 3, 140, 100));

    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
      null,
    ]);
    expect(canvas.captures.has(3)).toBe(false);
    expect(canvas.dataset.panning).toBe('false');
    expect(dispatchTap).not.toHaveBeenCalled();
  });

  it('applies fast direction changes immediately without queuing old motion', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 31, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 31, 170, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 31, 100, 170));
    canvas.dispatchEvent(pointerEvent('pointermove', 31, 30, 100));

    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
      'down',
      'left',
    ]);
  });

  it('stops in the player dead zone as the Carrier catches the finger', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 34, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 34, 140, 100));
    playerAnchor = { x: 120, y: 100, tileSize: 30 };

    controller.updatePlayerHold();

    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
      null,
    ]);

    canvas.dispatchEvent(pointerEvent('pointerup', 34, 140, 100));
    expect(dispatchTap).not.toHaveBeenCalled();
  });

  it('preserves a captured player drag across a mobile viewport reflow', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 32, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 32, 140, 100));
    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
    ]);

    canvas.top = 20;
    canvas.height = 280;
    viewport = { width: 400, height: 280 };
    controller.handleViewportResize();
    canvas.dispatchEvent(pointerEvent('pointermove', 32, 160, 100));

    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
    ]);
    expect(canvas.captures.has(32)).toBe(true);
  });

  it('does not cancel a captured player drag on orientationchange alone', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 33, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 33, 130, 100));
    onCancelTravel.mockClear();

    fakeWindow.dispatchEvent(new Event('orientationchange'));

    expect(onPlayerDirection).toHaveBeenLastCalledWith('right');
    expect(onCancelTravel).not.toHaveBeenCalled();
    expect(canvas.captures.has(33)).toBe(true);

    canvas.dispatchEvent(pointerEvent('pointerup', 33, 130, 100));
    expect(onPlayerDirection).toHaveBeenLastCalledWith(null);
  });

  it('falls back to a tap when the player hit area overlaps a nearby cell', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 30, 128, 100));
    canvas.dispatchEvent(pointerEvent('pointerup', 30, 128, 100));

    expect(onPlayerDirection).not.toHaveBeenCalled();
    expect(dispatchTap).toHaveBeenCalledWith({ x: 128, y: 100 });
  });

  it('cancels player movement when a second touch arrives and gives pinch priority', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 4, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 4, 130, 100));
    canvas.dispatchEvent(pointerEvent('pointerdown', 5, 200, 100));

    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
      null,
    ]);

    canvas.dispatchEvent(pointerEvent('pointermove', 5, 230, 100));

    expect(applyPinch).toHaveBeenCalledTimes(1);
    expect(applyPinch).toHaveBeenCalledWith({
      previousCentroid: { x: 165, y: 100 },
      nextCentroid: { x: 180, y: 100 },
      previousDistance: 70,
      nextDistance: 100,
    });
    expect(onPlayerDirection).toHaveBeenCalledTimes(2);
    expect(dispatchTap).not.toHaveBeenCalled();
  });

  it('rebases pinch to one-finger pan without dispatching a tap', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 6, 160, 120));
    canvas.dispatchEvent(pointerEvent('pointerdown', 7, 260, 120));
    canvas.dispatchEvent(pointerEvent('pointermove', 7, 280, 120));

    canvas.dispatchEvent(pointerEvent('pointerup', 7, 280, 120));

    expect(beginPan).toHaveBeenCalledTimes(1);
    expect(canvas.captures.has(7)).toBe(false);
    expect(canvas.captures.has(6)).toBe(true);

    canvas.dispatchEvent(pointerEvent('pointermove', 6, 178, 132));
    canvas.dispatchEvent(pointerEvent('pointerup', 6, 178, 132));

    expect(panBy).toHaveBeenCalledWith({ x: 18, y: 12 });
    expect(dispatchTap).not.toHaveBeenCalled();
    expect(canvas.captures.size).toBe(0);
  });

  it.each([
    'pointercancel',
    'lostpointercapture',
    'blur',
    'visibilitychange',
  ])('cancels movement and releases captures on %s', (eventType) => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 8, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 8, 140, 100));
    onCancelTravel.mockClear();

    if (eventType === 'pointercancel' || eventType === 'lostpointercapture') {
      canvas.dispatchEvent(pointerEvent(eventType, 8, 140, 100));
    } else if (eventType === 'visibilitychange') {
      fakeDocument.hidden = true;
      fakeDocument.dispatchEvent(new Event(eventType));
    } else {
      fakeWindow.dispatchEvent(new Event(eventType));
    }

    expect(onPlayerDirection.mock.calls.map(([direction]) => direction)).toEqual([
      'right',
      null,
    ]);
    expect(onCancelTravel).toHaveBeenCalledTimes(1);
    expect(canvas.captures.size).toBe(0);
    expect(canvas.dataset.panning).toBe('false');
  });

  it.each([0, 2])('retains mouse-button %i panning', (button) => {
    const down = pointerEvent('pointerdown', 9, 40, 50, 'mouse', button);
    canvas.dispatchEvent(down);

    expect(down.defaultPrevented).toBe(true);
    expect(beginPan).toHaveBeenCalledTimes(1);
    expect(canvas.captures.has(9)).toBe(true);
    expect(canvas.dataset.panning).toBe('true');

    canvas.dispatchEvent(pointerEvent('pointermove', 9, 72, 77, 'mouse', button));
    expect(panBy).toHaveBeenCalledWith({ x: 32, y: 27 });

    canvas.dispatchEvent(pointerEvent('pointerup', 9, 72, 77, 'mouse', button));
    expect(canvas.captures.has(9)).toBe(false);
    expect(canvas.dataset.panning).toBe('false');
    expect(dispatchTap).not.toHaveBeenCalled();
    expect(onPlayerDirection).not.toHaveBeenCalled();
  });

  it('rebases an active mouse pan after viewport and canvas geometry change', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 10, 40, 50, 'mouse'));
    canvas.dispatchEvent(pointerEvent('pointermove', 10, 72, 77, 'mouse'));
    expect(beginPan).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenLastCalledWith({ x: 32, y: 27 });

    canvas.left = 20;
    canvas.width = 480;
    viewport = { width: 480, height: 300 };
    controller.handleViewportResize();
    expect(beginPan).toHaveBeenCalledTimes(2);

    panBy.mockClear();
    canvas.dispatchEvent(pointerEvent('pointermove', 10, 82, 87, 'mouse'));
    expect(panBy).toHaveBeenCalledWith({ x: 10, y: 10 });
    expect(canvas.captures.has(10)).toBe(true);
  });

  it('hands an active mouse pan over to the first touch without shared capture', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 40, 40, 50, 'mouse'));
    expect(canvas.captures.has(40)).toBe(true);

    canvas.dispatchEvent(pointerEvent('pointerdown', 41, 220, 180));

    expect(canvas.captures.has(40)).toBe(false);
    expect(canvas.captures.has(41)).toBe(true);
    canvas.dispatchEvent(pointerEvent('pointermove', 41, 235, 180));
    expect(beginPan).toHaveBeenCalledTimes(2);
    expect(panBy).toHaveBeenLastCalledWith({ x: 15, y: 0 });
  });
});

import type { Direction } from '../game/types';
import { VirtualJoystick } from './VirtualJoystick';

class FakeStyle {
  public readonly values = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }
}

class FakeJoystickElement extends EventTarget {
  public readonly style = new FakeStyle();
  public readonly captures = new Set<number>();
  public readonly dataset: Record<string, string> = {};

  public querySelector(): HTMLElement | null {
    return null;
  }

  public getBoundingClientRect(): DOMRect {
    return {
      bottom: 120,
      height: 100,
      left: 20,
      right: 120,
      top: 20,
      width: 100,
      x: 20,
      y: 20,
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
): PointerEvent => {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    pointerType: { value: 'touch' },
  });
  return event as PointerEvent;
};

describe('VirtualJoystick', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let fakeWindow: EventTarget;
  let fakeDocument: FakeDocument;
  let element: FakeJoystickElement;
  let directions: Array<Direction | null>;
  let onViewportInterruption: jest.Mock<void, []>;
  let onUserGesture: jest.Mock<void, []>;
  let joystick: VirtualJoystick;

  beforeEach(() => {
    fakeWindow = new EventTarget();
    fakeDocument = new FakeDocument();
    element = new FakeJoystickElement();
    directions = [];
    onViewportInterruption = jest.fn();
    onUserGesture = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: fakeWindow,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument,
    });
    joystick = new VirtualJoystick(element as unknown as HTMLElement, {
      onDirectionChange: (direction) => directions.push(direction),
      onViewportInterruption,
      onUserGesture,
    });
    joystick.mount();
  });

  afterEach(() => {
    joystick.dispose();
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

  it('captures one pointer, clamps its thumb, and changes direction continuously', () => {
    element.dispatchEvent(pointerEvent('pointerdown', 4, 200, 70));

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(element.captures.has(4)).toBe(true);
    expect(element.dataset.active).toBe('true');
    expect(directions).toEqual(['right']);
    expect(element.style.values.get('--joystick-x')).toBe('50.00px');
    expect(element.style.values.get('--joystick-y')).toBe('0.00px');

    element.dispatchEvent(pointerEvent('pointerdown', 5, 70, 20));
    element.dispatchEvent(pointerEvent('pointermove', 5, 70, 120));
    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(directions).toEqual(['right']);

    element.dispatchEvent(pointerEvent('pointermove', 4, 70, 120));
    expect(directions).toEqual(['right', 'down']);
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'releases movement and recenters on %s',
    (eventType) => {
      element.dispatchEvent(pointerEvent('pointerdown', 7, 20, 70));
      element.dispatchEvent(pointerEvent(eventType, 7, 20, 70));

      expect(directions).toEqual(['left', null]);
      expect(element.captures.has(7)).toBe(false);
      expect(element.dataset.active).toBe('false');
      expect(element.style.values.get('--joystick-x')).toBe('0.00px');
      expect(element.style.values.get('--joystick-y')).toBe('0.00px');
    },
  );

  it.each(['resize', 'orientationchange'])(
    'releases movement on window %s',
    (eventType) => {
      element.dispatchEvent(pointerEvent('pointerdown', 8, 120, 70));
      fakeWindow.dispatchEvent(new Event(eventType));

      expect(directions).toEqual(['right', null]);
      expect(element.captures.has(8)).toBe(false);
      expect(onViewportInterruption).toHaveBeenCalledTimes(1);
    },
  );

  it('releases movement when the page becomes hidden', () => {
    element.dispatchEvent(pointerEvent('pointerdown', 9, 70, 20));
    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event('visibilitychange'));

    expect(directions).toEqual(['up', null]);
    expect(element.captures.has(9)).toBe(false);
  });
});

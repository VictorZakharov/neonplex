import type { InputFrame } from '../game/types';
import type { ActionChordState } from './ActionChordState';
import { InputManager } from './InputManager';

class FakeInputRoot extends EventTarget {
  public readonly dataset: Record<string, string> = {};

  public querySelector(): null {
    return null;
  }
}

class FakeInputDocument extends EventTarget {
  public hidden = false;
}

const callbacks = {
  onPause: jest.fn(),
  onRestart: jest.fn(),
  onRestartHint: jest.fn(),
  onPlayerStep: jest.fn(() => true),
  onCancelPlayerSteps: jest.fn(),
  onUserGesture: jest.fn(),
};

const createManager = (): InputManager =>
  new InputManager({} as HTMLElement, callbacks);

const withoutTravelTarget = (frame: InputFrame): InputFrame => frame;

describe('InputManager virtual input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets one virtual source change cardinal direction without a release', () => {
    const manager = createManager();

    manager.setVirtualDirection('joystick', 'right');
    expect(manager.consumeFrame().direction).toBe('right');

    manager.setVirtualDirection('joystick', 'down');
    expect(manager.consumeFrame().direction).toBe('down');

    manager.setVirtualDirection('joystick', null);
    expect(manager.consumeFrame().direction).toBeNull();
  });

  it('preserves held input on orientationchange while blur still clears it', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const fakeWindow = new EventTarget();
    const fakeDocument = new FakeInputDocument();
    const manager = new InputManager(
      new FakeInputRoot() as unknown as HTMLElement,
      callbacks,
    );

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: fakeWindow,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument,
    });

    try {
      manager.mount();
      manager.setVirtualDirection('joystick', 'right');

      fakeWindow.dispatchEvent(new Event('orientationchange'));
      expect(manager.consumeFrame().direction).toBe('right');

      fakeWindow.dispatchEvent(new Event('blur'));
      expect(manager.consumeFrame().direction).toBeNull();
    } finally {
      manager.dispose();
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
    }
  });

  it('resets the action hold and updates its chord when one source changes direction', () => {
    const manager = createManager();
    const chord = Reflect.get(manager, 'actionChord') as ActionChordState;
    chord.pressAction(null, 1_000);

    manager.setVirtualDirection('joystick', 'right');
    expect(chord.getDeploymentHoldProgress(1_200)).toBeNull();
    expect(manager.consumeFrame().excavate).toBe('right');

    manager.setVirtualDirection('joystick', 'down');
    expect(chord.getDeploymentHoldProgress(1_300)).toBeNull();
    expect(manager.consumeFrame().excavate).toBe('down');
  });

  it('restores the previous held source when the newest source releases', () => {
    const manager = createManager();

    manager.setVirtualDirection('keyboard-proxy', 'left');
    manager.setVirtualDirection('joystick', 'up');
    expect(manager.consumeFrame().direction).toBe('up');

    manager.setVirtualDirection('joystick', null);
    expect(manager.consumeFrame().direction).toBe('left');
  });

  it('emits a travel target exactly once and snapshots its coordinates', () => {
    const manager = createManager();
    const target = { x: 7, y: 11 };

    manager.queueTravelTarget(target);
    target.x = 99;

    expect(manager.consumeFrame()).toEqual({
      direction: null,
      action: false,
      excavate: null,
      travelTarget: { x: 7, y: 11 },
    });
    expect(withoutTravelTarget(manager.consumeFrame())).toEqual({
      direction: null,
      action: false,
      excavate: null,
    });
  });

  it('emits an explicit cancellation edge once', () => {
    const manager = createManager();
    manager.queueTravelTarget({ x: 3, y: 4 });
    manager.consumeFrame();

    manager.cancelTravel();
    expect(manager.consumeFrame()).toEqual({
      direction: null,
      action: false,
      excavate: null,
      travelTarget: null,
    });
    expect(manager.consumeFrame()).not.toHaveProperty('travelTarget');
  });

  it('delegates drag backpressure to the authoritative engine queue', () => {
    const manager = createManager();
    manager.queueTravelTarget({ x: 6, y: 4 });
    callbacks.onPlayerStep
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    expect(manager.queuePlayerStep('left')).toBe(true);
    expect(manager.queuePlayerStep('up')).toBe(false);

    expect(manager.consumeFrame()).toEqual({
      direction: null,
      action: false,
      excavate: null,
      travelTarget: null,
    });
    expect(callbacks.onPlayerStep.mock.calls).toEqual([['left'], ['up']]);
  });

  it('allows tap travel when the engine rejects the first drag step', () => {
    const manager = createManager();
    callbacks.onPlayerStep.mockReturnValueOnce(false);

    expect(manager.queuePlayerStep('right')).toBe(false);
    manager.queueTravelTarget({ x: 6, y: 4 });

    expect(manager.consumeFrame()).toEqual({
      direction: null,
      action: false,
      excavate: null,
      travelTarget: { x: 6, y: 4 },
    });
  });

  it('cancels authoritative engine steps immediately when a drag ends', () => {
    const manager = createManager();
    manager.queuePlayerStep('right');
    callbacks.onCancelPlayerSteps.mockClear();
    manager.endPlayerDrag();

    expect(callbacks.onCancelPlayerSteps).toHaveBeenCalledTimes(1);
    expect(manager.consumeFrame()).not.toHaveProperty('stepDirection');
  });

  it('hard-cancels queued finger steps when manual input takes control', () => {
    const manager = createManager();
    manager.queuePlayerStep('left');
    manager.queuePlayerStep('up');
    callbacks.onCancelPlayerSteps.mockClear();

    manager.setVirtualDirection('joystick', 'right');
    expect(manager.consumeFrame()).toEqual({
      direction: 'right',
      action: false,
      excavate: null,
    });
    expect(callbacks.onCancelPlayerSteps).toHaveBeenCalledTimes(1);

    manager.setVirtualDirection('joystick', null);
    expect(manager.consumeFrame()).not.toHaveProperty('stepDirection');
  });

  it('replaces queued travel with cancellation when manual input arrives', () => {
    const manager = createManager();
    manager.queueTravelTarget({ x: 5, y: 8 });

    manager.setVirtualDirection('joystick', 'right');

    expect(manager.consumeFrame()).toEqual({
      direction: 'right',
      action: false,
      excavate: null,
      travelTarget: null,
    });
  });

  it('cancels travel as soon as the action control is pressed', () => {
    const manager = createManager();
    manager.queueTravelTarget({ x: 5, y: 8 });
    Reflect.set(manager, 'beginActionHold', jest.fn());

    Reflect.get(manager, 'pressActionSource').call(manager, 'touch:pulse');
    manager.queueTravelTarget({ x: 9, y: 8 });

    expect(manager.consumeFrame()).toEqual({
      direction: null,
      action: false,
      excavate: null,
      travelTarget: null,
    });
    manager.dispose();
  });

  it('does not emit redundant cancellation edges without active travel', () => {
    const manager = createManager();

    manager.cancelTravel();

    expect(manager.consumeFrame()).not.toHaveProperty('travelTarget');
  });

  it('clears action and direction atomically without restarting deployment', () => {
    const manager = createManager();
    const chord = Reflect.get(manager, 'actionChord') as ActionChordState;
    const scheduleActionHold = jest.fn();
    Reflect.set(manager, 'scheduleActionHold', scheduleActionHold);
    chord.pressAction(null, 1_000);
    manager.setVirtualDirection('joystick', 'right');

    manager.clearGameplayState();

    expect(scheduleActionHold).not.toHaveBeenCalled();
    expect(manager.consumeFrame()).toEqual({
      direction: null,
      action: false,
      excavate: null,
    });
  });
});

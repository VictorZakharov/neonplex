import { App } from './App';

describe('App modal interaction boundary', () => {
  it('cancels captured gameplay gestures before clearing held input', () => {
    const originalAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      'requestAnimationFrame',
    );
    const cancelInteractions = jest.fn();
    const clearGameplayState = jest.fn();
    const modal = {
      hidden: true,
      querySelector: jest.fn(() => null),
      setAttribute: jest.fn(),
    };
    const app = new App({} as HTMLElement);
    Reflect.set(app, 'renderer', { cancelInteractions });
    Reflect.set(app, 'input', { clearGameplayState });
    Reflect.set(app, 'modal', modal);
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: jest.fn(() => 1),
    });

    try {
      const showModal = Reflect.get(app, 'showModal') as () => void;
      showModal.call(app);

      expect(cancelInteractions).toHaveBeenCalledTimes(1);
      expect(clearGameplayState).toHaveBeenCalledTimes(1);
      expect(cancelInteractions.mock.invocationCallOrder[0]).toBeLessThan(
        clearGameplayState.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
      expect(modal.hidden).toBe(false);
    } finally {
      if (originalAnimationFrame === undefined) {
        Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
      } else {
        Object.defineProperty(
          globalThis,
          'requestAnimationFrame',
          originalAnimationFrame,
        );
      }
    }
  });
});

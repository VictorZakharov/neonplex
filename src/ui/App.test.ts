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

describe('App sound toggle', () => {
  it('keeps the visual, tooltip, and accessible states synchronized', () => {
    const replaceChildren = jest.fn();
    const setAttribute = jest.fn();
    const soundButton = {
      dataset: { muted: 'false' },
      querySelector: jest.fn(() => ({ replaceChildren })),
      setAttribute,
      title: 'Mute sound',
    };
    const app = new App({} as HTMLElement);
    Reflect.set(app, 'soundButton', soundButton);
    const toggleSound = Reflect.get(app, 'toggleSound') as () => void;

    toggleSound.call(app);

    expect(soundButton.dataset.muted).toBe('true');
    expect(setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'false');
    expect(soundButton.title).toBe('Enable sound');
    expect(replaceChildren).toHaveBeenLastCalledWith('MUTED');

    toggleSound.call(app);

    expect(soundButton.dataset.muted).toBe('false');
    expect(setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
    expect(soundButton.title).toBe('Mute sound');
    expect(replaceChildren).toHaveBeenLastCalledWith('SOUND ON');
  });
});

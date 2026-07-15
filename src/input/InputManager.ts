import type { Direction, InputFrame, Point } from '../game/types';
import { ActionChordState } from './ActionChordState';
import type { InputCallbacks } from './inputTypes';
import {
  ACTION_HOLD_DURATION_MS,
  RESTART_HOLD_DURATION_MS,
  restartHoldProgress,
} from './restartHoldMath';
import { VirtualJoystick } from './VirtualJoystick';

type Command = Direction | 'action' | 'pause' | 'restart';

const KEY_BINDINGS: Readonly<Record<string, Command>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'action',
  Escape: 'pause',
  KeyP: 'pause',
  KeyR: 'restart',
};

export type { InputCallbacks } from './inputTypes';

export class InputManager {
  private readonly abortController = new AbortController();
  private readonly heldDirectionSources = new Map<string, Direction>();
  private readonly directionSourceOrder: string[] = [];
  private readonly actionSources = new Set<string>();
  private readonly actionChord = new ActionChordState();
  private virtualJoystick: VirtualJoystick | null = null;
  private pendingTravelTarget: Point | null | undefined;
  private travelActive = false;
  private restartStartedAt: number | null = null;
  private restartCompleted = false;
  private restartTimer = 0;
  private actionTimer = 0;

  public constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: InputCallbacks,
  ) {}

  public mount(): void {
    const options = { signal: this.abortController.signal };
    window.addEventListener('keydown', this.onKeyDown, options);
    window.addEventListener('keyup', this.onKeyUp, options);
    window.addEventListener('blur', this.clear, options);
    window.addEventListener('resize', this.clear, options);
    window.addEventListener('orientationchange', this.clear, options);
    document.addEventListener('visibilitychange', this.onVisibilityChange, options);
    this.root.addEventListener('pointerdown', this.onPointerModality, {
      ...options,
      capture: true,
    });
    this.root.addEventListener('pointerdown', this.onPointerDown, options);
    this.root.addEventListener('pointerup', this.onPointerUp, options);
    this.root.addEventListener('pointercancel', this.onPointerUp, options);
    this.root.addEventListener('contextmenu', this.preventContextMenu, options);

    const joystickElement = this.root.querySelector<HTMLElement>('[data-joystick]');
    if (joystickElement !== null) {
      this.virtualJoystick = new VirtualJoystick(joystickElement, {
        onDirectionChange: (direction) => {
          this.setVirtualDirection('joystick', direction);
        },
        onUserGesture: this.callbacks.onUserGesture,
      });
      this.virtualJoystick.mount();
    }
  }

  public consumeFrame(): InputFrame {
    const frame = this.actionChord.consume(this.currentDirection());
    const travelTarget = this.pendingTravelTarget;
    this.pendingTravelTarget = undefined;
    return travelTarget === undefined ? frame : { ...frame, travelTarget };
  }

  public setVirtualDirection(source: string, direction: Direction | null): void {
    if (direction === null) {
      this.releaseDirectionSource(source);
      return;
    }
    this.pressDirectionSource(source, direction);
  }

  public queueTravelTarget(target: Point): void {
    if (this.actionSources.size > 0 || this.currentDirection() !== null) return;
    this.pendingTravelTarget = { x: target.x, y: target.y };
    this.travelActive = true;
  }

  public cancelTravel(): void {
    if (!this.travelActive && this.pendingTravelTarget === undefined) return;
    this.pendingTravelTarget = null;
    this.travelActive = false;
  }

  public getRestartHoldProgress(currentTimeMs: number): number | null {
    if (this.restartStartedAt === null) return null;
    return restartHoldProgress(this.restartStartedAt, currentTimeMs);
  }

  public getActionHoldProgress(currentTimeMs: number): number | null {
    return this.actionChord.getDeploymentHoldProgress(currentTimeMs);
  }

  public clearGameplayState(): void {
    this.cancelActionTimer();
    this.heldDirectionSources.clear();
    this.directionSourceOrder.length = 0;
    this.actionSources.clear();
    this.actionChord.clear();
    this.virtualJoystick?.reset();
    this.cancelTravel();
  }

  public dispose(): void {
    this.virtualJoystick?.dispose();
    this.virtualJoystick = null;
    this.abortController.abort();
    this.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const command = KEY_BINDINGS[event.code];
    if (command === undefined) return;
    event.preventDefault();
    this.callbacks.onUserGesture();

    if (command === 'pause') {
      if (!event.repeat) this.callbacks.onPause();
      return;
    }
    if (command === 'restart') {
      if (!event.repeat) this.beginRestartHold();
      return;
    }
    if (command === 'action') {
      if (!event.repeat) this.pressActionSource(`key:${event.code}`);
      return;
    }
    this.pressDirectionSource(`key:${event.code}`, command);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const command = KEY_BINDINGS[event.code];
    if (command === undefined) return;
    event.preventDefault();
    if (command === 'restart') {
      this.releaseRestartHold(true);
      return;
    }
    if (command === 'action') {
      this.releaseActionSource(`key:${event.code}`);
      return;
    }
    if (command === 'up' || command === 'down' || command === 'left' || command === 'right') {
      this.releaseDirectionSource(`key:${event.code}`);
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-input]') : null;
    const command = target?.dataset.input as Command | undefined;
    if (command === undefined) return;
    event.preventDefault();
    target?.setPointerCapture?.(event.pointerId);
    this.callbacks.onUserGesture();
    if (command === 'action') {
      this.pressActionSource(`pointer:${event.pointerId}`);
    } else if (command === 'pause') {
      this.callbacks.onPause();
    } else if (command === 'restart') {
      this.callbacks.onRestart();
    } else {
      this.pressDirectionSource(`pointer:${event.pointerId}`, command);
    }
  };

  private readonly onPointerModality = (event: PointerEvent): void => {
    this.root.dataset.inputMode = event.pointerType === 'mouse' ? 'mouse' : 'touch';
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-input]') : null;
    const command = target?.dataset.input as Command | undefined;
    if (command === 'action') {
      this.releaseActionSource(`pointer:${event.pointerId}`);
    } else if (command === 'up' || command === 'down' || command === 'left' || command === 'right') {
      this.releaseDirectionSource(`pointer:${event.pointerId}`);
    }
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.clear();
  };

  private readonly preventContextMenu = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('[data-input]') !== null) {
      event.preventDefault();
    }
  };

  private readonly clear = (): void => {
    this.releaseRestartHold(false);
    this.cancelActionTimer();
    this.clearGameplayState();
  };

  private beginRestartHold(): void {
    if (this.restartStartedAt !== null || this.restartCompleted) return;
    this.restartStartedAt = performance.now();
    this.restartTimer = window.setTimeout(() => {
      if (this.restartStartedAt === null) return;
      this.restartStartedAt = null;
      this.restartCompleted = true;
      this.restartTimer = 0;
      this.callbacks.onRestart();
    }, RESTART_HOLD_DURATION_MS);
  }

  private beginActionHold(): void {
    const shouldSchedule = this.actionChord.pressAction(
      this.currentDirection(),
      performance.now(),
    );
    if (!shouldSchedule) return;
    this.scheduleActionHold();
  }

  private scheduleActionHold(): void {
    this.cancelActionTimer();
    this.actionTimer = window.setTimeout(() => {
      this.actionTimer = 0;
      this.actionChord.completeDeploymentHold();
    }, ACTION_HOLD_DURATION_MS);
  }

  private cancelActionTimer(): void {
    if (this.actionTimer !== 0) window.clearTimeout(this.actionTimer);
    this.actionTimer = 0;
  }

  private releaseRestartHold(showHint: boolean): void {
    if (this.restartTimer !== 0) window.clearTimeout(this.restartTimer);
    this.restartTimer = 0;
    if (this.restartStartedAt !== null && showHint) {
      if (restartHoldProgress(this.restartStartedAt, performance.now()) >= 1) {
        this.callbacks.onRestart();
      } else {
        this.callbacks.onRestartHint();
      }
    }
    this.restartStartedAt = null;
    this.restartCompleted = false;
  }

  private currentDirection(): Direction | null {
    const source = this.directionSourceOrder.at(-1);
    return source === undefined ? null : (this.heldDirectionSources.get(source) ?? null);
  }

  private pressDirectionSource(source: string, direction: Direction): void {
    const previousDirection = this.heldDirectionSources.get(source);
    if (previousDirection === direction) return;
    if (this.actionChord.pressDirection(direction)) this.cancelActionTimer();
    this.cancelTravel();
    this.heldDirectionSources.set(source, direction);
    const previousIndex = this.directionSourceOrder.indexOf(source);
    if (previousIndex >= 0) this.directionSourceOrder.splice(previousIndex, 1);
    this.directionSourceOrder.push(source);
  }

  private releaseDirectionSource(source: string): void {
    if (!this.heldDirectionSources.delete(source)) return;
    const index = this.directionSourceOrder.indexOf(source);
    if (index >= 0) this.directionSourceOrder.splice(index, 1);
    if (
      this.heldDirectionSources.size === 0 &&
      this.actionChord.restartDeploymentHold(performance.now())
    ) {
      this.scheduleActionHold();
    }
  }

  private pressActionSource(source: string): void {
    if (this.actionSources.has(source)) return;
    this.cancelTravel();
    this.actionSources.add(source);
    if (this.actionSources.size === 1) this.beginActionHold();
  }

  private releaseActionSource(source: string): void {
    if (!this.actionSources.delete(source) || this.actionSources.size > 0) return;
    const progress = this.actionChord.getDeploymentHoldProgress(performance.now());
    if (progress !== null && progress >= 1) this.actionChord.completeDeploymentHold();
    this.cancelActionTimer();
    this.actionChord.releaseAction();
  }
}

import type { Direction } from '../game/types';
import type { VirtualJoystickCallbacks } from './inputTypes';
import { calculateJoystickState } from './joystickMath';

const DEAD_ZONE_RATIO = 0.24;

export class VirtualJoystick {
  private readonly abortController = new AbortController();
  private activePointerId: number | null = null;
  private direction: Direction | null = null;
  private centerX = 0;
  private centerY = 0;
  private movementRadius = 0;

  public constructor(
    private readonly element: HTMLElement,
    private readonly callbacks: VirtualJoystickCallbacks,
  ) {}

  public mount(): void {
    const options = { signal: this.abortController.signal };
    this.element.addEventListener('pointerdown', this.onPointerDown, options);
    this.element.addEventListener('pointermove', this.onPointerMove, options);
    this.element.addEventListener('pointerup', this.onPointerEnd, options);
    this.element.addEventListener('pointercancel', this.onPointerEnd, options);
    this.element.addEventListener('lostpointercapture', this.onPointerEnd, options);
    window.addEventListener('resize', this.onViewportInterruption, options);
    window.addEventListener('orientationchange', this.onViewportInterruption, options);
    document.addEventListener('visibilitychange', this.onVisibilityChange, options);
    this.element.dataset.active = 'false';
    this.updateThumb(0, 0);
  }

  public reset = (): void => {
    const pointerId = this.activePointerId;
    this.activePointerId = null;
    if (pointerId !== null && this.element.hasPointerCapture?.(pointerId)) {
      this.element.releasePointerCapture?.(pointerId);
    }
    this.setDirection(null);
    this.element.dataset.active = 'false';
    this.updateThumb(0, 0);
  };

  public dispose(): void {
    this.abortController.abort();
    this.reset();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.activePointerId = event.pointerId;
    this.element.setPointerCapture?.(event.pointerId);
    this.element.dataset.active = 'true';
    this.callbacks.onUserGesture();
    this.measureGeometry();
    this.updateFromPointer(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.updateFromPointer(event);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.reset();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.reset();
  };

  private readonly onViewportInterruption = (): void => {
    if (this.activePointerId !== null) this.callbacks.onViewportInterruption?.();
    this.reset();
  };

  private updateFromPointer(event: PointerEvent): void {
    const state = calculateJoystickState(
      event.clientX - this.centerX,
      event.clientY - this.centerY,
      this.movementRadius,
      this.movementRadius * DEAD_ZONE_RATIO,
      this.direction,
    );
    this.updateThumb(state.offsetX, state.offsetY);
    this.setDirection(state.direction);
  }

  private measureGeometry(): void {
    const bounds = this.element.getBoundingClientRect();
    const thumb = this.element.querySelector<HTMLElement>('.virtual-joystick__thumb');
    const thumbBounds = thumb?.getBoundingClientRect();
    const baseDiameter = Math.min(bounds.width, bounds.height);
    const thumbDiameter = thumbBounds === undefined
      ? 0
      : Math.min(thumbBounds.width, thumbBounds.height);
    this.centerX = bounds.left + bounds.width / 2;
    this.centerY = bounds.top + bounds.height / 2;
    this.movementRadius = Math.max(0, (baseDiameter - thumbDiameter) / 2);
  }

  private setDirection(direction: Direction | null): void {
    if (direction === this.direction) return;
    this.direction = direction;
    this.callbacks.onDirectionChange(direction);
  }

  private updateThumb(x: number, y: number): void {
    this.element.style.setProperty('--joystick-x', `${x.toFixed(2)}px`);
    this.element.style.setProperty('--joystick-y', `${y.toFixed(2)}px`);
  }
}

import type { Direction } from '../game/types';
import {
  directionFromDisplacement,
  distanceBetween,
  isPlayerHit,
  midpointBetween,
  playerGestureRadius,
  stabilizedPinchDistance,
} from './gestureMath';
import type {
  CameraInteractionCallbacks,
  CanvasGestureHost,
  ScreenPoint,
  TouchGestureMode,
} from './renderTypes';

const TOUCH_PAN_THRESHOLD = 10;
/** Arbitrates mouse pan, touch pan, player drag, tap and pinch gestures. */
export class CanvasGestureController {
  private readonly abortController = new AbortController();
  private readonly touchPoints = new Map<number, ScreenPoint>();
  private canvasLeft = 0;
  private canvasTop = 0;
  private canvasScaleX = 1;
  private canvasScaleY = 1;
  private canvasGeometryReady = false;
  private mousePanPointerId: number | null = null;
  private mousePanStart: ScreenPoint = { x: 0, y: 0 };
  private mousePanPoint: ScreenPoint = { x: 0, y: 0 };
  private touchMode: TouchGestureMode = 'idle';
  private primaryTouchId: number | null = null;
  private touchStart: ScreenPoint = { x: 0, y: 0 };
  private pinchPointerIds: readonly [number, number] | null = null;
  private pinchCentroid: ScreenPoint = { x: 0, y: 0 };
  private pinchScaleDistance = 1;
  private playerHoldDirection: Direction | null = null;
  private playerHoldEngaged = false;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: CanvasGestureHost,
    private readonly interactions: CameraInteractionCallbacks,
  ) {
    canvas.addEventListener('wheel', this.onWheel, {
      passive: false,
      signal: this.abortController.signal,
    });
    canvas.addEventListener('pointerdown', this.onPointerDown, {
      signal: this.abortController.signal,
    });
    canvas.addEventListener('pointermove', this.onPointerMove, {
      signal: this.abortController.signal,
    });
    canvas.addEventListener('pointerup', this.onPointerUp, {
      signal: this.abortController.signal,
    });
    canvas.addEventListener('pointercancel', this.onPointerCancelled, {
      signal: this.abortController.signal,
    });
    canvas.addEventListener('lostpointercapture', this.onPointerCaptureLost, {
      signal: this.abortController.signal,
    });
    canvas.addEventListener('contextmenu', this.preventCanvasContextMenu, {
      signal: this.abortController.signal,
    });
    window.addEventListener('blur', this.onWindowBlur, {
      signal: this.abortController.signal,
    });
    document.addEventListener('visibilitychange', this.onVisibilityChange, {
      signal: this.abortController.signal,
    });
  }

  public dispose(): void {
    this.cancel(true);
    this.abortController.abort();
  }

  public cancel(cancelTravel: boolean): void {
    this.cancelTouchGesture(cancelTravel);
    this.cancelMousePan(cancelTravel);
  }

  /** Re-evaluates a stationary finger against the Carrier's live screen position. */
  public updatePlayerHold(): void {
    if (this.touchMode !== 'player' || this.primaryTouchId === null) return;
    const point = this.touchPoints.get(this.primaryTouchId);
    const player = this.host.getPlayerScreenAnchor();
    if (point === undefined || player === null) {
      this.setPlayerHoldDirection(null);
      return;
    }
    const deadZone = playerGestureRadius(player.tileSize);
    const direction = directionFromDisplacement(
      { x: point.x - player.x, y: point.y - player.y },
      this.playerHoldDirection,
      deadZone,
    );
    this.setPlayerHoldDirection(direction);
  }

  /** Preserves active pointers while their canvas coordinate space changes. */
  public handleViewportResize(): void {
    if (!this.canvasGeometryReady) {
      this.measureCanvasGeometry();
      return;
    }

    const previousLeft = this.canvasLeft;
    const previousTop = this.canvasTop;
    const previousScaleX = this.canvasScaleX;
    const previousScaleY = this.canvasScaleY;
    this.measureCanvasGeometry();

    const remap = (point: ScreenPoint): ScreenPoint => ({
      x: (
        previousLeft + point.x / previousScaleX - this.canvasLeft
      ) * this.canvasScaleX,
      y: (
        previousTop + point.y / previousScaleY - this.canvasTop
      ) * this.canvasScaleY,
    });

    this.touchStart = remap(this.touchStart);
    this.mousePanStart = remap(this.mousePanStart);
    this.mousePanPoint = remap(this.mousePanPoint);
    this.pinchCentroid = remap(this.pinchCentroid);
    for (const [pointerId, point] of this.touchPoints) {
      this.touchPoints.set(pointerId, remap(point));
    }

    if (this.touchMode === 'pinch' && this.pinchPointerIds !== null) {
      const first = this.touchPoints.get(this.pinchPointerIds[0]);
      const second = this.touchPoints.get(this.pinchPointerIds[1]);
      if (first !== undefined && second !== undefined) {
        this.pinchCentroid = midpointBetween(first, second);
        this.pinchScaleDistance = Math.max(0.001, distanceBetween(first, second));
      }
    }
    this.rebaseActivePan();
  }

  private canvasPoint(event: MouseEvent): ScreenPoint {
    if (!this.canvasGeometryReady) this.measureCanvasGeometry();
    return {
      x: (event.clientX - this.canvasLeft) * this.canvasScaleX,
      y: (event.clientY - this.canvasTop) * this.canvasScaleY,
    };
  }

  private measureCanvasGeometry(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const viewport = this.host.getViewport();
    this.canvasLeft = bounds.left;
    this.canvasTop = bounds.top;
    this.canvasScaleX = bounds.width > 0 ? viewport.width / bounds.width : 1;
    this.canvasScaleY = bounds.height > 0 ? viewport.height / bounds.height : 1;
    this.canvasGeometryReady = true;
  }

  private invalidateCanvasGeometry(): void {
    this.canvasGeometryReady = false;
  }

  private capturePointer(pointerId: number): void {
    if (!this.canvas.hasPointerCapture(pointerId)) {
      this.canvas.setPointerCapture(pointerId);
    }
  }

  private releasePointer(pointerId: number): void {
    if (this.canvas.hasPointerCapture(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }

  private updatePanningState(): void {
    const panning =
      this.mousePanPointerId !== null ||
      this.touchMode === 'pan' ||
      this.touchMode === 'pinch';
    this.canvas.dataset.panning = String(panning);
  }

  private rebaseActivePan(): void {
    if (this.mousePanPointerId !== null) {
      this.mousePanStart = { ...this.mousePanPoint };
      this.host.beginPan();
      return;
    }
    if (this.touchMode !== 'pan' || this.primaryTouchId === null) return;
    const point = this.touchPoints.get(this.primaryTouchId);
    if (point === undefined) return;
    this.touchStart = { ...point };
    this.host.beginPan();
  }

  private beginUserGesture(): void {
    this.interactions.onUserGesture?.();
    this.interactions.onCancelTravel?.();
  }

  private beginMousePan(event: PointerEvent): void {
    const supportedButton = event.button === 0 || event.button === 2;
    if (!supportedButton || this.mousePanPointerId !== null || this.touchPoints.size > 0) {
      return;
    }
    event.preventDefault();
    this.beginUserGesture();
    this.measureCanvasGeometry();
    this.mousePanPointerId = event.pointerId;
    this.mousePanStart = this.canvasPoint(event);
    this.mousePanPoint = { ...this.mousePanStart };
    this.host.beginPan();
    this.capturePointer(event.pointerId);
    this.updatePanningState();
  }

  private updateMousePan(event: PointerEvent): void {
    if (event.pointerId !== this.mousePanPointerId) return;
    event.preventDefault();
    const point = this.canvasPoint(event);
    this.mousePanPoint = point;
    if (distanceBetween(this.mousePanStart, point) < 2) return;
    this.host.panBy({
      x: point.x - this.mousePanStart.x,
      y: point.y - this.mousePanStart.y,
    });
  }

  private endMousePan(pointerId: number): void {
    if (pointerId !== this.mousePanPointerId) return;
    this.mousePanPointerId = null;
    this.releasePointer(pointerId);
    this.invalidateCanvasGeometry();
    this.updatePanningState();
  }

  private beginFirstTouch(event: PointerEvent, point: ScreenPoint): void {
    this.primaryTouchId = event.pointerId;
    this.touchStart = point;
    const player = this.host.getPlayerScreenAnchor();
    this.touchMode = isPlayerHit(point, player)
      ? 'player'
      : 'tap';
    this.playerHoldEngaged = false;
    if (this.touchMode === 'player') this.updatePlayerHold();
    this.updatePanningState();
  }

  private beginPinch(): void {
    const entries = [...this.touchPoints.entries()];
    const first = entries[0];
    const second = entries[1];
    if (first === undefined || second === undefined) return;
    this.setPlayerHoldDirection(null);
    this.playerHoldEngaged = false;
    this.primaryTouchId = null;
    this.touchMode = 'pinch';
    this.pinchPointerIds = [first[0], second[0]];
    this.pinchCentroid = midpointBetween(first[1], second[1]);
    this.pinchScaleDistance = Math.max(0.001, distanceBetween(first[1], second[1]));
    this.updatePanningState();
  }

  private updatePinch(): void {
    if (this.pinchPointerIds === null) return;
    const first = this.touchPoints.get(this.pinchPointerIds[0]);
    const second = this.touchPoints.get(this.pinchPointerIds[1]);
    if (first === undefined || second === undefined) return;
    const centroid = midpointBetween(first, second);
    const distance = Math.max(0.001, distanceBetween(first, second));
    const stabilizedDistance = stabilizedPinchDistance(
      this.pinchScaleDistance,
      distance,
    );
    this.host.applyPinch({
      previousCentroid: this.pinchCentroid,
      nextCentroid: centroid,
      previousDistance: this.pinchScaleDistance,
      nextDistance: stabilizedDistance,
    });
    this.pinchCentroid = centroid;
    this.pinchScaleDistance = stabilizedDistance;
  }

  private updateSingleTouch(event: PointerEvent, point: ScreenPoint): void {
    if (event.pointerId !== this.primaryTouchId) return;
    const displacement = {
      x: point.x - this.touchStart.x,
      y: point.y - this.touchStart.y,
    };
    if (this.touchMode === 'player') {
      this.updatePlayerHold();
      return;
    }

    if (
      this.touchMode === 'tap' &&
      distanceBetween(this.touchStart, point) >= TOUCH_PAN_THRESHOLD
    ) {
      this.touchMode = 'pan';
      this.host.beginPan();
      this.updatePanningState();
    }
    if (this.touchMode === 'pan') this.host.panBy(displacement);
  }

  private rebaseRemainingTouchAsPan(): void {
    const remaining = [...this.touchPoints.entries()][0];
    if (remaining === undefined) {
      this.finishTouchGesture();
      return;
    }
    this.primaryTouchId = remaining[0];
    this.touchStart = remaining[1];
    this.touchMode = 'pan';
    this.pinchPointerIds = null;
    this.host.beginPan();
    this.updatePanningState();
  }

  private finishTouchGesture(): void {
    this.setPlayerHoldDirection(null);
    this.playerHoldEngaged = false;
    this.primaryTouchId = null;
    this.pinchPointerIds = null;
    this.touchMode = 'idle';
    this.invalidateCanvasGeometry();
    this.updatePanningState();
  }

  private setPlayerHoldDirection(direction: Direction | null): void {
    if (direction === this.playerHoldDirection) return;
    this.playerHoldDirection = direction;
    if (direction !== null) this.playerHoldEngaged = true;
    this.interactions.onPlayerDirection?.(direction);
  }

  private cancelTouchGesture(cancelTravel: boolean): void {
    const pointerIds = [...this.touchPoints.keys()];
    const wasActive = pointerIds.length > 0 || this.touchMode !== 'idle';
    this.touchPoints.clear();
    this.finishTouchGesture();
    if (cancelTravel && wasActive) this.interactions.onCancelTravel?.();
    for (const pointerId of pointerIds) this.releasePointer(pointerId);
  }

  private cancelMousePan(cancelTravel: boolean): void {
    const pointerId = this.mousePanPointerId;
    if (pointerId === null) return;
    this.mousePanPointerId = null;
    if (cancelTravel) this.interactions.onCancelTravel?.();
    this.releasePointer(pointerId);
    this.invalidateCanvasGeometry();
    this.updatePanningState();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      this.beginMousePan(event);
      return;
    }
    if (this.mousePanPointerId !== null) this.cancelMousePan(false);
    event.preventDefault();
    this.beginUserGesture();
    if (this.touchPoints.size === 0) this.measureCanvasGeometry();
    const point = this.canvasPoint(event);
    this.touchPoints.set(event.pointerId, point);
    this.capturePointer(event.pointerId);
    if (this.touchPoints.size === 1) {
      this.beginFirstTouch(event, point);
    } else if (this.touchPoints.size === 2) {
      this.beginPinch();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.mousePanPointerId) {
      this.updateMousePan(event);
      return;
    }
    if (!this.touchPoints.has(event.pointerId)) return;
    event.preventDefault();
    const point = this.canvasPoint(event);
    this.touchPoints.set(event.pointerId, point);
    if (this.touchMode === 'pinch') {
      this.updatePinch();
    } else {
      this.updateSingleTouch(event, point);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.mousePanPointerId) {
      this.endMousePan(event.pointerId);
      return;
    }
    if (!this.touchPoints.has(event.pointerId)) return;
    event.preventDefault();
    const finalPoint = this.canvasPoint(event);
    this.touchPoints.set(event.pointerId, finalPoint);
    const wasPinchPointer = this.pinchPointerIds?.includes(event.pointerId) ?? false;
    if (
      this.touchMode === 'tap' &&
      event.pointerId === this.primaryTouchId &&
      this.touchPoints.size === 1
    ) {
      this.host.dispatchTap(finalPoint);
    }
    if (
      this.touchMode === 'player' &&
      event.pointerId === this.primaryTouchId &&
      !this.playerHoldEngaged &&
      distanceBetween(this.touchStart, finalPoint) < TOUCH_PAN_THRESHOLD
    ) {
      this.host.dispatchTap(finalPoint);
    }
    this.touchPoints.delete(event.pointerId);
    this.releasePointer(event.pointerId);

    if (this.touchMode === 'pinch') {
      if (wasPinchPointer && this.touchPoints.size >= 2) {
        this.beginPinch();
      } else if (this.touchPoints.size === 1) {
        this.rebaseRemainingTouchAsPan();
      } else if (this.touchPoints.size === 0) {
        this.finishTouchGesture();
      }
      return;
    }
    if (this.touchPoints.size === 0) this.finishTouchGesture();
  };

  private readonly onPointerCancelled = (event: PointerEvent): void => {
    if (event.pointerId === this.mousePanPointerId) {
      this.cancelMousePan(true);
      return;
    }
    if (this.touchPoints.has(event.pointerId)) this.cancelTouchGesture(true);
  };

  private readonly onPointerCaptureLost = (event: PointerEvent): void => {
    if (event.pointerId === this.mousePanPointerId) {
      this.cancelMousePan(true);
    } else if (this.touchPoints.has(event.pointerId)) {
      this.cancelTouchGesture(true);
    }
  };

  private readonly onWindowBlur = (): void => {
    this.cancel(true);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.cancel(true);
  };

  private readonly preventCanvasContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.deltaY === 0) return;
    this.measureCanvasGeometry();
    this.beginUserGesture();
    this.host.zoomFromWheel(event.deltaY < 0, this.canvasPoint(event));
  };
}

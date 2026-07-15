import type { GameSnapshot } from '../game/types';
import { exponentialApproach, interpolatedProgress } from './animationMath';
import { clampCameraAxis, preserveZoomAnchorAxis } from './cameraMath';
import type {
  BoardLayout,
  CameraFocus,
  PlayerScreenAnchor,
  Viewport,
} from './renderTypes';

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

/** Owns camera follow, optical zoom and direct pointer panning. */
export class CameraController {
  private readonly abortController = new AbortController();
  private zoom = 1;
  private targetZoom = 1;
  private lastZoomPercent = 100;
  private cameraLeft = 0;
  private cameraTop = 0;
  private cameraReady = false;
  private lastBaseTile = 32;
  private lastFocusX = 0;
  private lastFocusY = 0;
  private lastSnapshot: GameSnapshot | null = null;
  private playerScreenAnchor: PlayerScreenAnchor | null = null;
  private viewport: Viewport = { width: 1, height: 1 };
  private panPointerId: number | null = null;
  private panStartClientX = 0;
  private panStartClientY = 0;
  private panStartCameraLeft = 0;
  private panStartCameraTop = 0;
  private panTravel = 0;
  private manuallyPanned = false;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly zoomLabel: HTMLElement,
    private readonly reducedMotion: MediaQueryList,
  ) {
    canvas.addEventListener('wheel', this.onWheel, {
      passive: false,
      signal: this.abortController.signal,
    });
    canvas.addEventListener('pointerdown', this.onPanPointerDown, {
      signal: this.abortController.signal,
    });
    canvas.addEventListener('pointermove', this.onPanPointerMove, {
      signal: this.abortController.signal,
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      canvas.addEventListener(eventName, this.onPanPointerEnd, {
        signal: this.abortController.signal,
      });
    }
    canvas.addEventListener('contextmenu', this.preventCanvasContextMenu, {
      signal: this.abortController.signal,
    });
  }

  public dispose(): void {
    this.abortController.abort();
  }

  public reset(): void {
    if (
      this.panPointerId !== null &&
      this.canvas.hasPointerCapture(this.panPointerId)
    ) {
      this.canvas.releasePointerCapture(this.panPointerId);
    }
    this.cameraReady = false;
    this.lastSnapshot = null;
    this.playerScreenAnchor = null;
    this.manuallyPanned = false;
    this.panPointerId = null;
    this.canvas.dataset.panning = 'false';
  }

  public updateZoom(deltaSeconds: number, viewport: Viewport): void {
    this.viewport = viewport;
    const previousZoom = this.zoom;
    const approachedZoom = this.reducedMotion.matches
      ? this.targetZoom
      : exponentialApproach(this.zoom, this.targetZoom, 16, deltaSeconds);
    this.zoom = Math.abs(approachedZoom - this.targetZoom) < 0.0005
      ? this.targetZoom
      : approachedZoom;

    const snapshot = this.lastSnapshot;
    if (snapshot !== null && this.cameraReady && this.zoom !== previousZoom) {
      const previousTile = this.lastBaseTile * previousZoom;
      const nextTile = this.lastBaseTile * this.zoom;
      const padding = this.outerPadding();
      this.cameraLeft = preserveZoomAnchorAxis({
        cameraOffset: this.cameraLeft,
        focusGridCoordinate: this.lastFocusX,
        previousTileSize: previousTile,
        nextTileSize: nextTile,
        boardCells: snapshot.width,
        viewportSize: viewport.width,
        padding,
      });
      this.cameraTop = preserveZoomAnchorAxis({
        cameraOffset: this.cameraTop,
        focusGridCoordinate: this.lastFocusY,
        previousTileSize: previousTile,
        nextTileSize: nextTile,
        boardCells: snapshot.height,
        viewportSize: viewport.height,
        padding,
      });
    }

    const zoomPercent = Math.round(this.zoom * 100);
    if (zoomPercent !== this.lastZoomPercent) {
      this.lastZoomPercent = zoomPercent;
      this.zoomLabel.textContent = `OPTICS ${zoomPercent}%`;
    }
  }

  public layoutFor(
    snapshot: GameSnapshot,
    delta: number,
    renderLeadSeconds: number,
    viewport: Viewport,
  ): BoardLayout {
    this.viewport = viewport;
    const padding = this.outerPadding();
    const baseTile = Math.max(
      26,
      Math.min(54, Math.min(viewport.width / 15, viewport.height / 10.5)),
    );
    const tile = baseTile * this.zoom;
    const width = tile * snapshot.width;
    const height = tile * snapshot.height;
    const playerMotion = interpolatedProgress(
      snapshot.playerMotion,
      renderLeadSeconds,
      snapshot.playerMotionDurationSeconds,
    );
    const focusX = lerp(snapshot.previousPlayer.x, snapshot.player.x, playerMotion) + 0.5;
    const focusY = lerp(snapshot.previousPlayer.y, snapshot.player.y, playerMotion) + 0.5;
    const playerMoved =
      this.lastSnapshot !== null &&
      (this.lastSnapshot.player.x !== snapshot.player.x ||
        this.lastSnapshot.player.y !== snapshot.player.y);
    if (playerMoved) this.manuallyPanned = false;

    const targetLeft = clampCameraAxis(
      viewport.width / 2 - focusX * tile,
      width,
      viewport.width,
      padding,
    );
    const targetTop = clampCameraAxis(
      viewport.height / 2 - focusY * tile,
      height,
      viewport.height,
      padding,
    );
    if (!this.cameraReady) {
      this.cameraLeft = targetLeft;
      this.cameraTop = targetTop;
      this.cameraReady = true;
    } else if (!this.manuallyPanned) {
      const follow = this.reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 8.5);
      this.cameraLeft = lerp(this.cameraLeft, targetLeft, follow);
      this.cameraTop = lerp(this.cameraTop, targetTop, follow);
    } else {
      this.clampPannedCamera();
    }

    this.lastBaseTile = baseTile;
    this.lastFocusX = focusX;
    this.lastFocusY = focusY;
    this.lastSnapshot = snapshot;
    this.playerScreenAnchor = {
      x: this.cameraLeft + focusX * tile,
      y: this.cameraTop + focusY * tile,
      tileSize: tile,
    };
    return { tile, width, height, left: this.cameraLeft, top: this.cameraTop };
  }

  public getPlayerScreenAnchor(): PlayerScreenAnchor | null {
    return this.playerScreenAnchor === null ? null : { ...this.playerScreenAnchor };
  }

  public getFocus(): CameraFocus {
    return { x: this.lastFocusX, y: this.lastFocusY };
  }

  private outerPadding(): number {
    return Math.max(14, Math.min(this.viewport.width, this.viewport.height) * 0.035);
  }

  private clampPannedCamera(): void {
    const snapshot = this.lastSnapshot;
    if (snapshot === null) return;
    const tile = this.lastBaseTile * this.zoom;
    const padding = this.outerPadding();
    this.cameraLeft = clampCameraAxis(
      this.cameraLeft,
      snapshot.width * tile,
      this.viewport.width,
      padding,
    );
    this.cameraTop = clampCameraAxis(
      this.cameraTop,
      snapshot.height * tile,
      this.viewport.height,
      padding,
    );
  }

  private readonly onPanPointerDown = (event: PointerEvent): void => {
    const supportsButton =
      event.pointerType !== 'mouse' || event.button === 0 || event.button === 2;
    if (!supportsButton || this.panPointerId !== null) return;
    event.preventDefault();
    this.panPointerId = event.pointerId;
    this.panStartClientX = event.clientX;
    this.panStartClientY = event.clientY;
    this.panStartCameraLeft = this.cameraLeft;
    this.panStartCameraTop = this.cameraTop;
    this.panTravel = 0;
    this.canvas.dataset.panning = 'true';
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPanPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.panPointerId) return;
    event.preventDefault();
    this.panTravel = Math.hypot(
      event.clientX - this.panStartClientX,
      event.clientY - this.panStartClientY,
    );
    if (this.panTravel < 2) return;
    this.manuallyPanned = true;
    this.cameraLeft = this.panStartCameraLeft + event.clientX - this.panStartClientX;
    this.cameraTop = this.panStartCameraTop + event.clientY - this.panStartClientY;
    this.clampPannedCamera();
  };

  private readonly onPanPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.panPointerId) return;
    this.panPointerId = null;
    this.canvas.dataset.panning = 'false';
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly preventCanvasContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.deltaY === 0) return;
    const factor = event.deltaY < 0 ? 1.11 : 1 / 1.11;
    this.targetZoom = Math.max(0.68, Math.min(1.72, this.targetZoom * factor));
  };
}

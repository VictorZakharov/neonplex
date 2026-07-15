import type { GameSnapshot } from '../game/types';
import { exponentialApproach, interpolatedProgress } from './animationMath';
import { clampCameraAxis, preserveZoomAnchorAxis } from './cameraMath';
import { CanvasGestureController } from './CanvasGestureController';
import {
  gridPointAtScreen,
  preserveViewportWorldCenter,
  transformCameraForPinch,
} from './gestureMath';
import type {
  BoardLayout,
  CameraFocus,
  CameraInteractionCallbacks,
  PinchGestureUpdate,
  PlayerScreenAnchor,
  ScreenPoint,
  Viewport,
} from './renderTypes';

const MINIMUM_ZOOM = 0.68;
const MAXIMUM_ZOOM = 1.72;
const ZOOM_STEP = 1.11;

const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

const zoomLabelPrefix = (label: HTMLElement): string => {
  const configuredPrefix = label.dataset.zoomPrefix;
  if (configuredPrefix !== undefined) {
    return configuredPrefix.length > 0 ? `${configuredPrefix} ` : '';
  }
  return label.textContent?.includes('OPTICS') === true ? 'OPTICS ' : '';
};

/** Owns camera follow and delegates pointer arbitration to the gesture controller. */
export class CameraController {
  private readonly gestures: CanvasGestureController;
  private readonly zoomLabelPrefixes = new Map<HTMLElement, string>();
  private zoom = 1;
  private targetZoom = 1;
  private lastZoomPercent = -1;
  private cameraLeft = 0;
  private cameraTop = 0;
  private cameraReady = false;
  private lastBaseTile = 32;
  private lastFocusX = 0;
  private lastFocusY = 0;
  private lastSnapshot: GameSnapshot | null = null;
  private lastLayout: BoardLayout | null = null;
  private playerScreenAnchor: PlayerScreenAnchor | null = null;
  private viewport: Viewport = { width: 1, height: 1 };
  private panStartCameraLeft = 0;
  private panStartCameraTop = 0;
  private zoomAnchorGridX: number | null = null;
  private zoomAnchorGridY: number | null = null;
  private manuallyPanned = false;

  public constructor(
    canvas: HTMLCanvasElement,
    private readonly zoomLabels: readonly HTMLElement[],
    private readonly reducedMotion: MediaQueryList,
    private readonly interactions: CameraInteractionCallbacks,
  ) {
    for (const label of zoomLabels) {
      this.zoomLabelPrefixes.set(label, zoomLabelPrefix(label));
    }
    this.gestures = new CanvasGestureController(
      canvas,
      {
        getViewport: () => this.viewport,
        getPlayerScreenAnchor: () => this.getPlayerScreenAnchor(),
        beginPan: () => this.beginPan(),
        panBy: (displacement) => this.panBy(displacement),
        applyPinch: (update) => this.applyPinch(update),
        dispatchTap: (point) => this.dispatchTravelTarget(point),
        zoomFromWheel: (zoomIn, focalPoint) => {
          this.setAnimatedZoomAnchor(focalPoint);
          this.adjustTargetZoom(zoomIn);
        },
      },
      interactions,
    );
  }

  public dispose(): void {
    this.gestures.dispose();
  }

  public cancelInteractions(): void {
    this.gestures.cancel(true);
  }

  public reset(): void {
    this.cancelInteractions();
    this.cameraReady = false;
    this.lastSnapshot = null;
    this.lastLayout = null;
    this.playerScreenAnchor = null;
    this.clearAnimatedZoomAnchor();
    this.manuallyPanned = false;
  }

  public handleViewportResize(viewport: Viewport): void {
    const previousViewport = this.viewport;
    const dimensionsChanged =
      viewport.width !== previousViewport.width ||
      viewport.height !== previousViewport.height;
    this.viewport = viewport;

    if (dimensionsChanged) {
      this.settleAnimatedZoom();
      const snapshot = this.lastSnapshot;
      if (snapshot !== null && this.cameraReady) {
        if (this.manuallyPanned) {
          const camera = preserveViewportWorldCenter({
            cameraLeft: this.cameraLeft,
            cameraTop: this.cameraTop,
            previousViewport,
            nextViewport: viewport,
            previousTileSize: this.lastBaseTile * this.zoom,
            nextTileSize: this.baseTileForViewport(viewport) * this.zoom,
            boardWidth: snapshot.width,
            boardHeight: snapshot.height,
            padding: this.outerPaddingFor(viewport),
          });
          this.cameraLeft = camera.left;
          this.cameraTop = camera.top;
        } else {
          this.cameraReady = false;
        }
      }
    }

    // Rebase pointer and pan origins only after the camera has its preserved position.
    this.gestures.handleViewportResize();
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
        focusGridCoordinate: this.zoomAnchorGridX ?? this.lastFocusX,
        previousTileSize: previousTile,
        nextTileSize: nextTile,
        boardCells: snapshot.width,
        viewportSize: viewport.width,
        padding,
      });
      this.cameraTop = preserveZoomAnchorAxis({
        cameraOffset: this.cameraTop,
        focusGridCoordinate: this.zoomAnchorGridY ?? this.lastFocusY,
        previousTileSize: previousTile,
        nextTileSize: nextTile,
        boardCells: snapshot.height,
        viewportSize: viewport.height,
        padding,
      });
    }
    this.updateZoomLabel();
    if (this.zoom === this.targetZoom) this.clearAnimatedZoomAnchor();
  }

  public layoutFor(
    snapshot: GameSnapshot,
    delta: number,
    renderLeadSeconds: number,
    viewport: Viewport,
  ): BoardLayout {
    this.viewport = viewport;
    const padding = this.outerPadding();
    const baseTile = this.baseTileForViewport(viewport);
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
    if (playerMoved) {
      this.manuallyPanned = false;
      this.clearAnimatedZoomAnchor();
    }

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
    this.gestures.updatePlayerHold();
    const layout = {
      tile,
      width,
      height,
      left: this.cameraLeft,
      top: this.cameraTop,
    };
    this.lastLayout = layout;
    return layout;
  }

  public getPlayerScreenAnchor(): PlayerScreenAnchor | null {
    return this.playerScreenAnchor === null ? null : { ...this.playerScreenAnchor };
  }

  public getFocus(): CameraFocus {
    return { x: this.lastFocusX, y: this.lastFocusY };
  }

  private outerPadding(): number {
    return this.outerPaddingFor(this.viewport);
  }

  private baseTileForViewport(viewport: Viewport): number {
    return Math.max(
      26,
      Math.min(54, Math.min(viewport.width / 15, viewport.height / 10.5)),
    );
  }

  private outerPaddingFor(viewport: Viewport): number {
    return Math.max(14, Math.min(viewport.width, viewport.height) * 0.035);
  }

  private clampZoom(zoom: number): number {
    return Math.max(MINIMUM_ZOOM, Math.min(MAXIMUM_ZOOM, zoom));
  }

  private updateZoomLabel(): void {
    const zoomPercent = Math.round(this.zoom * 100);
    if (zoomPercent === this.lastZoomPercent) return;
    this.lastZoomPercent = zoomPercent;
    for (const label of this.zoomLabels) {
      label.textContent = `${this.zoomLabelPrefixes.get(label) ?? ''}${zoomPercent}%`;
    }
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

  private beginPan(): void {
    this.settleAnimatedZoom();
    this.panStartCameraLeft = this.cameraLeft;
    this.panStartCameraTop = this.cameraTop;
  }

  private panBy(displacement: ScreenPoint): void {
    this.manuallyPanned = true;
    this.cameraLeft = this.panStartCameraLeft + displacement.x;
    this.cameraTop = this.panStartCameraTop + displacement.y;
    this.clampPannedCamera();
  }

  private applyPinch(update: PinchGestureUpdate): void {
    const snapshot = this.lastSnapshot;
    if (snapshot === null || !this.cameraReady) return;
    const camera = transformCameraForPinch({
      cameraLeft: this.cameraLeft,
      cameraTop: this.cameraTop,
      previousCentroid: update.previousCentroid,
      nextCentroid: update.nextCentroid,
      previousDistance: update.previousDistance,
      nextDistance: update.nextDistance,
      baseTileSize: this.lastBaseTile,
      zoom: this.zoom,
      minimumZoom: MINIMUM_ZOOM,
      maximumZoom: MAXIMUM_ZOOM,
      boardWidth: snapshot.width,
      boardHeight: snapshot.height,
      viewport: this.viewport,
      padding: this.outerPadding(),
    });
    this.manuallyPanned = true;
    this.clearAnimatedZoomAnchor();
    this.cameraLeft = camera.left;
    this.cameraTop = camera.top;
    this.zoom = camera.zoom;
    this.targetZoom = camera.zoom;
    this.updateZoomLabel();
  }

  private dispatchTravelTarget(point: ScreenPoint): void {
    const target = gridPointAtScreen(point, this.lastLayout);
    const player = this.lastSnapshot?.player;
    if (target === null || player === undefined) return;
    const aligned = target.x === player.x || target.y === player.y;
    const isCurrentCell = target.x === player.x && target.y === player.y;
    if (aligned && !isCurrentCell) this.interactions.onTravelTarget?.(target);
  }

  private setAnimatedZoomAnchor(point: ScreenPoint): void {
    if (!this.cameraReady) return;
    const tile = this.lastBaseTile * this.zoom;
    this.zoomAnchorGridX = (point.x - this.cameraLeft) / tile;
    this.zoomAnchorGridY = (point.y - this.cameraTop) / tile;
    this.manuallyPanned = true;
  }

  private clearAnimatedZoomAnchor(): void {
    this.zoomAnchorGridX = null;
    this.zoomAnchorGridY = null;
  }

  private settleAnimatedZoom(): void {
    this.targetZoom = this.zoom;
    this.clearAnimatedZoomAnchor();
  }

  private adjustTargetZoom(zoomIn: boolean): void {
    const factor = zoomIn ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.targetZoom = this.clampZoom(this.targetZoom * factor);
  }
}

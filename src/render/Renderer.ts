import type { GameEvent, GameSnapshot } from '../game/types';
import { BoardRenderer } from './BoardRenderer';
import { CameraController } from './CameraController';
import { ExitIndicatorRenderer } from './ExitIndicatorRenderer';
import { IntelPreviewRenderer } from './IntelPreviewRenderer';
import { MinimapRenderer } from './MinimapRenderer';
import type { IntelPreviewKind, PlayerScreenAnchor, Viewport } from './renderTypes';
import { ScreenEffectsRenderer } from './ScreenEffectsRenderer';
import { TilePainter } from './TilePainter';

export type { IntelPreviewKind, PlayerScreenAnchor } from './renderTypes';

/** Coordinates the render pipeline; specialized modules own each visual concern. */
export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly tiles = new TilePainter();
  private readonly board = new BoardRenderer(this.tiles);
  private readonly previews = new IntelPreviewRenderer(this.tiles);
  private readonly effects = new ScreenEffectsRenderer(this.reducedMotion);
  private readonly camera: CameraController;
  private readonly minimap: MinimapRenderer;
  private readonly exitIndicator = new ExitIndicatorRenderer(this.tiles, this.reducedMotion);
  private width = 1;
  private height = 1;
  private dpr = 1;
  private time = 0;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
    zoomLabel: HTMLElement,
  ) {
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (context === null) throw new Error('Canvas 2D is unavailable in this browser.');
    this.context = context;
    this.camera = new CameraController(canvas, zoomLabel, this.reducedMotion);
    this.minimap = new MinimapRenderer(minimapCanvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resizeObserver.observe(minimapCanvas);
    this.resize();
  }

  public render(
    snapshot: GameSnapshot,
    deltaSeconds: number,
    events: readonly GameEvent[],
    renderLeadSeconds = 0,
  ): void {
    const delta = Math.min(0.05, Math.max(0, deltaSeconds));
    this.time += delta;
    const viewport = this.viewport();
    this.effects.update(delta, events);
    this.camera.updateZoom(delta, viewport);
    this.tiles.beginFrame(this.time, this.dpr);

    const context = this.context;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.effects.drawBackdrop(context);

    const layout = this.camera.layoutFor(snapshot, delta, renderLeadSeconds, viewport);
    const shake = this.effects.shakeOffset(this.time, layout.tile);
    context.save();
    context.translate(shake.x, shake.y);
    this.board.draw(context, snapshot, layout, viewport, renderLeadSeconds, this.time);
    this.effects.drawParticles(context, layout);
    context.restore();

    this.effects.drawPostProcessing(context);
    this.exitIndicator.draw(context, snapshot, layout, viewport, this.time);
    this.minimap.draw(snapshot, layout, viewport, this.time, this.camera.getFocus());
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
    this.camera.dispose();
    this.tiles.clearCache();
    this.effects.reset();
    this.minimap.reset();
  }

  public resetCamera(): void {
    this.camera.reset();
    this.effects.reset();
    this.minimap.reset();
    this.exitIndicator.reset();
  }

  public getPlayerScreenAnchor(): PlayerScreenAnchor | null {
    return this.camera.getPlayerScreenAnchor();
  }

  public renderIntelPreview(canvas: HTMLCanvasElement, kind: IntelPreviewKind): void {
    this.tiles.beginFrame(this.time, this.dpr);
    this.previews.render(canvas, kind);
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);
    const sizeChanged =
      this.canvas.width !== targetWidth || this.canvas.height !== targetHeight;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    if (sizeChanged) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.tiles.clearCache();
    }
    const viewport = this.viewport();
    this.effects.resize(viewport, dpr);
    this.minimap.resize(dpr);
  }

  private viewport(): Viewport {
    return { width: this.width, height: this.height };
  }
}

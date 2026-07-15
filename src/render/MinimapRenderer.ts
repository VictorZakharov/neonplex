import { Tile, type GameSnapshot } from '../game/types';
import type { BoardLayout, CameraFocus, Viewport } from './renderTypes';

/** Owns the tactical map canvas and its low-frequency board cache. */
export class MinimapRenderer {
  private readonly context: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private cache: HTMLCanvasElement | null = null;
  private levelIndex = -1;
  private updatedAt = -1;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (context === null) throw new Error('Minimap Canvas 2D is unavailable in this browser.');
    this.context = context;
  }

  public resize(dpr: number): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(bounds.width));
    this.height = Math.max(1, Math.round(bounds.height));
    this.dpr = dpr;
    const targetWidth = Math.round(this.width * dpr);
    const targetHeight = Math.round(this.height * dpr);
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.cache = null;
    }
  }

  public reset(): void {
    this.cache = null;
    this.levelIndex = -1;
    this.updatedAt = -1;
  }

  public draw(
    snapshot: GameSnapshot,
    layout: BoardLayout,
    viewport: Viewport,
    time: number,
    focus: CameraFocus,
  ): void {
    const padding = 7;
    const availableWidth = Math.max(1, this.width - padding * 2);
    const availableHeight = Math.max(1, this.height - padding * 2);
    const mapScale = Math.min(
      availableWidth / snapshot.width,
      availableHeight / snapshot.height,
    );
    const actualWidth = snapshot.width * mapScale;
    const actualHeight = snapshot.height * mapScale;
    const left = (this.width - actualWidth) / 2;
    const top = (this.height - actualHeight) / 2;

    const context = this.context;
    context.save();
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.fillStyle = '#020811';
    context.fillRect(0, 0, this.width, this.height);
    if (
      this.cache === null ||
      this.levelIndex !== snapshot.levelIndex ||
      time - this.updatedAt >= 0.5
    ) {
      this.rebuild(snapshot, mapScale, actualWidth, actualHeight, time);
    }
    if (this.cache !== null) {
      context.imageSmoothingEnabled = false;
      context.drawImage(this.cache, left, top, actualWidth, actualHeight);
      context.imageSmoothingEnabled = true;
    }

    const firstVisibleX = Math.max(0, Math.min(snapshot.width, -layout.left / layout.tile));
    const firstVisibleY = Math.max(0, Math.min(snapshot.height, -layout.top / layout.tile));
    const lastVisibleX = Math.max(
      0,
      Math.min(snapshot.width, (viewport.width - layout.left) / layout.tile),
    );
    const lastVisibleY = Math.max(
      0,
      Math.min(snapshot.height, (viewport.height - layout.top) / layout.tile),
    );
    context.strokeStyle = 'rgba(224, 251, 255, 0.88)';
    context.lineWidth = 1;
    context.strokeRect(
      left + firstVisibleX * mapScale,
      top + firstVisibleY * mapScale,
      Math.max(2, (lastVisibleX - firstVisibleX) * mapScale),
      Math.max(2, (lastVisibleY - firstVisibleY) * mapScale),
    );
    context.fillStyle = '#ffad58';
    context.shadowColor = 'rgba(255, 173, 88, 0.75)';
    context.shadowBlur = 5;
    context.beginPath();
    context.arc(
      left + focus.x * mapScale,
      top + focus.y * mapScale,
      Math.max(2, mapScale * 0.72),
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  }

  private rebuild(
    snapshot: GameSnapshot,
    mapScale: number,
    width: number,
    height: number,
    time: number,
  ): void {
    const cache = document.createElement('canvas');
    cache.width = Math.max(1, Math.ceil(width));
    cache.height = Math.max(1, Math.ceil(height));
    const context = cache.getContext('2d');
    if (context === null) return;
    for (let y = 0; y < snapshot.height; y += 1) {
      for (let x = 0; x < snapshot.width; x += 1) {
        const tile = snapshot.tiles[y * snapshot.width + x] ?? Tile.Empty;
        if (tile === Tile.Empty || tile === Tile.Dirt) continue;
        context.fillStyle = this.tileColor(tile);
        context.fillRect(
          x * mapScale,
          y * mapScale,
          Math.max(1, mapScale),
          Math.max(1, mapScale),
        );
      }
    }
    this.cache = cache;
    this.levelIndex = snapshot.levelIndex;
    this.updatedAt = time;
  }

  private tileColor(tile: Tile): string {
    switch (tile) {
      case Tile.Steel:
        return '#536878';
      case Tile.Carbon:
        return '#8c6d50';
      case Tile.Wall:
        return '#8764ff';
      case Tile.Infotron:
        return '#c5ffff';
      case Tile.Zonk:
        return '#a5aeb7';
      case Tile.ExitClosed:
        return '#ff496e';
      case Tile.ExitOpen:
        return '#5effc6';
      case Tile.Enemy:
        return '#ff43bd';
      case Tile.Disk:
      case Tile.Bomb:
        return '#ffe26b';
      case Tile.Explosion:
        return '#ffffff';
      case Tile.Empty:
      case Tile.Dirt:
        return '#142331';
    }
  }
}

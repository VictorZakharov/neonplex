import { Tile, type GameSnapshot } from '../game/types';
import { offscreenEdgeIndicator } from './exitIndicatorMath';
import type { BoardLayout, Viewport } from './renderTypes';
import type { TilePainter } from './TilePainter';

/** Draws the open exit sprite and chevron when the gate is off screen. */
export class ExitIndicatorRenderer {
  private levelIndex = -1;
  private tileIndex = -1;

  public constructor(
    private readonly tiles: TilePainter,
    private readonly reducedMotion: MediaQueryList,
  ) {}

  public reset(): void {
    this.levelIndex = -1;
    this.tileIndex = -1;
  }

  public draw(
    context: CanvasRenderingContext2D,
    snapshot: GameSnapshot,
    layout: BoardLayout,
    viewport: Viewport,
    time: number,
  ): void {
    const exitIndex = this.resolveExitIndex(snapshot);
    if (exitIndex < 0 || snapshot.tiles[exitIndex] !== Tile.ExitOpen) return;
    const exitX = exitIndex % snapshot.width;
    const exitY = Math.floor(exitIndex / snapshot.width);
    const target = {
      x: layout.left + (exitX + 0.5) * layout.tile,
      y: layout.top + (exitY + 0.5) * layout.tile,
    };
    const indicator = offscreenEdgeIndicator(
      target,
      viewport,
      layout.tile * 0.5,
      Math.max(24, layout.tile * 0.58),
    );
    if (indicator === null) return;

    const pulse = this.reducedMotion.matches ? 1 : 1 + Math.sin(time * 5) * 0.08;
    const radius = Math.max(13, Math.min(22, layout.tile * 0.3)) * pulse;
    const directionX = Math.cos(indicator.angle);
    const directionY = Math.sin(indicator.angle);
    const iconSize = radius * 1.9;
    const iconCenter = {
      x: indicator.position.x - directionX * radius * 1.55,
      y: indicator.position.y - directionY * radius * 1.55,
    };
    this.tiles.drawExit(
      context,
      iconCenter.x - iconSize / 2,
      iconCenter.y - iconSize / 2,
      iconSize,
      true,
    );

    context.save();
    context.translate(indicator.position.x, indicator.position.y);
    context.rotate(indicator.angle);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = '#5effc6';
    context.shadowBlur = radius * 0.9;
    context.strokeStyle = 'rgba(1, 12, 17, 0.95)';
    context.lineWidth = Math.max(7, radius * 0.42);
    context.beginPath();
    context.moveTo(-radius * 0.42, -radius * 0.62);
    context.lineTo(radius * 0.36, 0);
    context.lineTo(-radius * 0.42, radius * 0.62);
    context.stroke();
    context.shadowBlur = radius * 0.48;
    context.strokeStyle = '#9affdc';
    context.lineWidth = Math.max(2.5, radius * 0.2);
    context.stroke();
    context.restore();
  }

  private resolveExitIndex(snapshot: GameSnapshot): number {
    const cachedTile = snapshot.tiles[this.tileIndex];
    if (
      this.levelIndex === snapshot.levelIndex &&
      (cachedTile === Tile.ExitClosed || cachedTile === Tile.ExitOpen)
    ) {
      return this.tileIndex;
    }
    this.levelIndex = snapshot.levelIndex;
    this.tileIndex = snapshot.tiles.findIndex(
      (tile) => tile === Tile.ExitClosed || tile === Tile.ExitOpen,
    );
    return this.tileIndex;
  }
}

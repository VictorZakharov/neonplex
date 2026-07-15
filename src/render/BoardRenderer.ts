import {
  Tile,
  type CellConsumption,
  type EnemyPose,
  type GameSnapshot,
} from '../game/types';
import { interpolatedProgress, remainingDirtRect } from './animationMath';
import { enemyFacingAngle } from './enemyFacingMath';
import type { BoardLayout, TileRenderEntry, Viewport } from './renderTypes';
import type { TilePainter } from './TilePainter';

const TAU = Math.PI * 2;
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

/** Draws the board layers while preserving gameplay-critical sprite ordering. */
export class BoardRenderer {
  public constructor(private readonly tiles: TilePainter) {}

  public draw(
    context: CanvasRenderingContext2D,
    snapshot: GameSnapshot,
    layout: BoardLayout,
    viewport: Viewport,
    renderLeadSeconds: number,
    time: number,
  ): void {
    this.drawBoardFrame(context, layout, viewport);
    const bombOverlays = this.drawTiles(
      context,
      snapshot,
      layout,
      viewport,
      renderLeadSeconds,
      time,
    );
    this.drawPlayer(context, snapshot, layout, renderLeadSeconds, time);
    for (const bomb of bombOverlays) {
      this.tiles.drawTile(
        context,
        bomb.tile,
        bomb.x,
        bomb.y,
        layout.tile,
        bomb.gridX,
        bomb.gridY,
      );
    }
  }

  private drawBoardFrame(
    context: CanvasRenderingContext2D,
    layout: BoardLayout,
    viewport: Viewport,
  ): void {
    const margin = layout.tile * 0.28;
    const visibleLeft = Math.max(0, layout.left - margin);
    const visibleTop = Math.max(0, layout.top - margin);
    const visibleRight = Math.min(viewport.width, layout.left + layout.width + margin);
    const visibleBottom = Math.min(viewport.height, layout.top + layout.height + margin);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return;
    context.save();
    const border = context.createLinearGradient(
      layout.left,
      layout.top,
      layout.left + layout.width,
      layout.top,
    );
    border.addColorStop(0, 'rgba(50, 235, 255, 0.55)');
    border.addColorStop(0.5, 'rgba(117, 89, 255, 0.2)');
    border.addColorStop(1, 'rgba(255, 55, 193, 0.45)');
    context.strokeStyle = border;
    context.lineWidth = Math.max(1, layout.tile * 0.035);
    context.strokeRect(
      layout.left - margin,
      layout.top - margin,
      layout.width + margin * 2,
      layout.height + margin * 2,
    );
    context.restore();
  }

  private drawTiles(
    context: CanvasRenderingContext2D,
    snapshot: GameSnapshot,
    layout: BoardLayout,
    viewport: Viewport,
    renderLeadSeconds: number,
    time: number,
  ): readonly TileRenderEntry[] {
    const firstX = Math.max(0, Math.floor(-layout.left / layout.tile) - 1);
    const lastX = Math.min(
      snapshot.width - 1,
      Math.ceil((viewport.width - layout.left) / layout.tile) + 1,
    );
    const firstY = Math.max(0, Math.floor(-layout.top / layout.tile) - 1);
    const lastY = Math.min(
      snapshot.height - 1,
      Math.ceil((viewport.height - layout.top) / layout.tile) + 1,
    );
    const movingDestinations = new Set(
      snapshot.tileMotions.map((motion) => motion.to.y * snapshot.width + motion.to.x),
    );
    const enemyAngles = new Map(
      snapshot.enemies.map((enemy) => [
        enemy.position.y * snapshot.width + enemy.position.x,
        this.enemyPoseAngle(enemy, renderLeadSeconds),
      ]),
    );
    const foregroundTiles: TileRenderEntry[] = [];
    const bombOverlays: TileRenderEntry[] = [];

    for (let y = firstY; y <= lastY; y += 1) {
      for (let x = firstX; x <= lastX; x += 1) {
        const tileIndex = y * snapshot.width + x;
        const tile = snapshot.tiles[tileIndex] ?? Tile.Steel;
        const px = layout.left + x * layout.tile;
        const py = layout.top + y * layout.tile;
        const isMoving = movingDestinations.has(tileIndex);
        const isStatic =
          tile === Tile.Dirt ||
          tile === Tile.Steel ||
          tile === Tile.Carbon ||
          tile === Tile.Wall;
        if (!isMoving && isStatic) {
          this.tiles.drawStaticTile(context, tile, px, py, layout.tile);
        } else {
          this.tiles.drawCachedCellUnderlay(context, px, py, layout.tile);
          if (tile !== Tile.Empty && !isMoving) {
            const entry = {
              tile,
              gridX: x,
              gridY: y,
              x: px,
              y: py,
              enemyAngle: enemyAngles.get(tileIndex),
            };
            if (tile === Tile.Bomb) bombOverlays.push(entry);
            else foregroundTiles.push(entry);
          }
        }
      }
    }

    this.drawCellConsumptions(context, snapshot, layout, renderLeadSeconds, time);
    for (const foreground of foregroundTiles) {
      this.tiles.drawTile(
        context,
        foreground.tile,
        foreground.x,
        foreground.y,
        layout.tile,
        foreground.gridX,
        foreground.gridY,
        foreground.enemyAngle,
      );
    }
    this.drawTileMotions(
      context,
      snapshot,
      layout,
      viewport,
      renderLeadSeconds,
      enemyAngles,
    );
    return bombOverlays;
  }

  private drawCellConsumptions(
    context: CanvasRenderingContext2D,
    snapshot: GameSnapshot,
    layout: BoardLayout,
    renderLeadSeconds: number,
    time: number,
  ): void {
    for (const consumption of snapshot.cellConsumptions) {
      if (consumption.kind === 'remote') {
        this.drawRemoteCellConsumption(context, consumption, layout, renderLeadSeconds, time);
      } else {
        this.drawTraversalDirtConsumption(context, consumption, layout, renderLeadSeconds);
      }
    }
  }

  private drawTraversalDirtConsumption(
    context: CanvasRenderingContext2D,
    consumption: CellConsumption,
    layout: BoardLayout,
    renderLeadSeconds: number,
  ): void {
    const progress = interpolatedProgress(
      consumption.progress,
      renderLeadSeconds,
      consumption.durationSeconds,
    );
    if (progress >= 1) return;
    const x = layout.left + consumption.position.x * layout.tile;
    const y = layout.top + consumption.position.y * layout.tile;
    const size = layout.tile;
    const remainingRect = remainingDirtRect(consumption.direction, progress);
    context.save();
    context.beginPath();
    context.rect(
      x + size * remainingRect.x,
      y + size * remainingRect.y,
      size * remainingRect.width,
      size * remainingRect.height,
    );
    context.clip();
    this.tiles.drawStaticTile(context, Tile.Dirt, x, y, size);
    context.restore();

    const edgeAlpha = Math.sin(progress * Math.PI);
    if (edgeAlpha <= 0.01) return;
    context.save();
    context.globalAlpha = edgeAlpha * 0.72;
    context.strokeStyle = '#70efff';
    context.shadowColor = '#42dff8';
    context.shadowBlur = size * 0.12;
    context.lineWidth = Math.max(1, size * 0.025);
    context.beginPath();
    if (consumption.direction === 'right' || consumption.direction === 'left') {
      const edgeX =
        x + size * (consumption.direction === 'right' ? progress : remainingRect.width);
      context.moveTo(edgeX, y + size * 0.08);
      context.lineTo(edgeX, y + size * 0.92);
    } else {
      const edgeY =
        y + size * (consumption.direction === 'down' ? progress : remainingRect.height);
      context.moveTo(x + size * 0.08, edgeY);
      context.lineTo(x + size * 0.92, edgeY);
    }
    context.stroke();
    context.restore();
  }

  private drawRemoteCellConsumption(
    context: CanvasRenderingContext2D,
    consumption: CellConsumption,
    layout: BoardLayout,
    renderLeadSeconds: number,
    time: number,
  ): void {
    const progress = interpolatedProgress(
      consumption.progress,
      renderLeadSeconds,
      consumption.durationSeconds,
    );
    if (progress >= 1) return;
    const x = layout.left + consumption.position.x * layout.tile;
    const y = layout.top + consumption.position.y * layout.tile;
    const size = layout.tile;
    const centerX = x + size * 0.5;
    const centerY = y + size * 0.5;
    const holeRadius = size * (0.02 + progress * 0.72);
    const effectAlpha = Math.sin(progress * Math.PI);

    context.save();
    context.beginPath();
    context.rect(x, y, size, size);
    context.arc(centerX, centerY, holeRadius, 0, TAU);
    context.clip('evenodd');
    this.tiles.drawTile(
      context,
      consumption.tile,
      x,
      y,
      size,
      consumption.position.x,
      consumption.position.y,
    );
    context.restore();

    context.save();
    context.globalAlpha = effectAlpha;
    context.translate(centerX, centerY);
    const directionSign =
      consumption.direction === 'left' || consumption.direction === 'up' ? -1 : 1;
    context.rotate(time * 8 * directionSign + progress * Math.PI * 2);
    const auraRadius = Math.max(size * 0.1, holeRadius * 0.72);
    const core = context.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
    core.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
    core.addColorStop(0.46, 'rgba(5, 2, 16, 0.96)');
    core.addColorStop(0.72, 'rgba(112, 65, 255, 0.55)');
    core.addColorStop(1, 'rgba(72, 226, 255, 0)');
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, auraRadius, 0, TAU);
    context.fill();
    context.lineCap = 'round';
    for (const [radius, color, phase] of [
      [0.3, 'rgba(108, 238, 255, 0.9)', 0],
      [0.42, 'rgba(159, 90, 255, 0.72)', 1.8],
      [0.54, 'rgba(73, 125, 255, 0.5)', 3.5],
    ] as const) {
      context.strokeStyle = color;
      context.lineWidth = Math.max(1, size * 0.024 * (1 - progress * 0.45));
      context.beginPath();
      context.arc(
        0,
        0,
        size * radius * (0.45 + progress * 0.55),
        phase,
        phase + Math.PI * 1.35,
      );
      context.stroke();
    }
    context.restore();
  }

  private drawTileMotions(
    context: CanvasRenderingContext2D,
    snapshot: GameSnapshot,
    layout: BoardLayout,
    viewport: Viewport,
    renderLeadSeconds: number,
    enemyAngles: ReadonlyMap<number, number>,
  ): void {
    for (const motion of snapshot.tileMotions) {
      const renderProgress = interpolatedProgress(
        motion.progress,
        renderLeadSeconds,
        motion.durationSeconds,
      );
      const progress = renderProgress;
      const gridX = lerp(motion.from.x, motion.to.x, progress);
      const gridY = lerp(motion.from.y, motion.to.y, progress);
      const x = layout.left + gridX * layout.tile;
      const y = layout.top + gridY * layout.tile;
      if (
        x + layout.tile < -layout.tile ||
        y + layout.tile < -layout.tile ||
        x > viewport.width + layout.tile ||
        y > viewport.height + layout.tile
      ) {
        continue;
      }
      context.save();
      if (motion.kind === 'roll') {
        const centerX = x + layout.tile * 0.5;
        const centerY = y + layout.tile * 0.5;
        const rotation = ((motion.to.x - motion.from.x) * progress) / 0.37;
        context.translate(centerX, centerY);
        context.rotate(rotation);
        context.translate(-centerX, -centerY);
      }
      this.tiles.drawTile(
        context,
        motion.tile,
        x,
        y,
        layout.tile,
        motion.to.x,
        motion.to.y,
        motion.tile === Tile.Enemy
          ? enemyAngles.get(motion.to.y * snapshot.width + motion.to.x)
          : undefined,
      );
      context.restore();
    }
  }

  private enemyPoseAngle(enemy: EnemyPose | undefined, renderLeadSeconds: number): number {
    if (enemy === undefined) return 0;
    if (enemy.turnFrom === null) return enemyFacingAngle(enemy.facing, enemy.facing, 1);
    const progress = interpolatedProgress(
      enemy.turnProgress,
      renderLeadSeconds,
      enemy.turnDurationSeconds,
    );
    return enemyFacingAngle(enemy.turnFrom, enemy.facing, progress);
  }

  private drawPlayer(
    context: CanvasRenderingContext2D,
    snapshot: GameSnapshot,
    layout: BoardLayout,
    renderLeadSeconds: number,
    time: number,
  ): void {
    if (snapshot.phase === 'lost') return;
    const renderProgress = interpolatedProgress(
      snapshot.playerMotion,
      renderLeadSeconds,
      snapshot.playerMotionDurationSeconds,
    );
    const gridX = lerp(snapshot.previousPlayer.x, snapshot.player.x, renderProgress);
    const gridY = lerp(snapshot.previousPlayer.y, snapshot.player.y, renderProgress);
    const size = layout.tile;
    const cx = layout.left + (gridX + 0.5) * size;
    const cy = layout.top + (gridY + 0.5) * size + Math.sin(time * 5) * size * 0.018;
    const travelPulse = Math.sin(renderProgress * Math.PI) ** 2;
    this.tiles.drawCarrier(
      context,
      cx,
      cy,
      size,
      snapshot.facing,
      1 + travelPulse * 0.06,
      1 - travelPulse * 0.04,
    );
  }
}

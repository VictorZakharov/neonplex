import { Tile } from '../game/types';
import type { IntelPreviewKind } from './renderTypes';
import type { TilePainter } from './TilePainter';

const TAU = Math.PI * 2;

/** Renders learning cards from the same sprite painters used in gameplay. */
export class IntelPreviewRenderer {
  public constructor(private readonly tiles: TilePainter) {}

  public render(canvas: HTMLCanvasElement, kind: IntelPreviewKind): void {
    const logicalSize = 72;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(logicalSize * dpr);
    canvas.height = Math.round(logicalSize * dpr);
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, logicalSize, logicalSize);
    context.fillStyle = '#07111c';
    context.fillRect(0, 0, logicalSize, logicalSize);
    const inset = 5;
    const size = logicalSize - inset * 2;
    this.tiles.drawCellUnderlay(context, inset, inset, size);

    const tileByKind: Partial<Record<IntelPreviewKind, Tile>> = {
      dirt: Tile.Dirt,
      infotron: Tile.Infotron,
      zonk: Tile.Zonk,
      wall: Tile.Wall,
      steel: Tile.Steel,
      carbon: Tile.Carbon,
      exit: Tile.ExitClosed,
      enemy: Tile.Enemy,
      disk: Tile.Disk,
    };
    const tile = tileByKind[kind];
    if (tile !== undefined) {
      this.tiles.drawTile(context, tile, inset, inset, size, 0, 0, 0);
      return;
    }
    if (kind === 'player') {
      this.tiles.drawCarrier(context, logicalSize / 2, logicalSize / 2, size, 'right');
    } else if (kind === 'map') {
      this.drawMap(context, inset, inset, size);
    } else if (kind === 'cascade') {
      this.drawCascade(context, inset, inset, size);
    } else {
      this.drawChain(context, inset, inset, size);
    }
  }

  private drawMap(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    context.save();
    context.strokeStyle = 'rgba(101, 231, 255, 0.28)';
    context.lineWidth = 1;
    for (let step = 1; step < 5; step += 1) {
      const offset = (size * step) / 5;
      context.beginPath();
      context.moveTo(x + offset, y + size * 0.08);
      context.lineTo(x + offset, y + size * 0.92);
      context.moveTo(x + size * 0.08, y + offset);
      context.lineTo(x + size * 0.92, y + offset);
      context.stroke();
    }
    context.strokeStyle = '#65e7ff';
    context.lineWidth = 2;
    context.strokeRect(x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84);
    context.fillStyle = '#ff9f43';
    context.shadowColor = '#ff9f43';
    context.shadowBlur = size * 0.14;
    context.beginPath();
    context.arc(x + size * 0.62, y + size * 0.42, size * 0.07, 0, TAU);
    context.fill();
    context.restore();
  }

  private drawCascade(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    this.tiles.drawZonk(context, x + size * 0.1, y + size * 0.02, size * 0.62, 0);
    context.save();
    context.strokeStyle = '#ff7b67';
    context.shadowColor = '#ff526f';
    context.shadowBlur = size * 0.15;
    context.lineWidth = Math.max(2, size * 0.055);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(x + size * 0.7, y + size * 0.22);
    context.lineTo(x + size * 0.7, y + size * 0.78);
    context.moveTo(x + size * 0.54, y + size * 0.62);
    context.lineTo(x + size * 0.7, y + size * 0.78);
    context.lineTo(x + size * 0.86, y + size * 0.62);
    context.stroke();
    context.restore();
  }

  private drawChain(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    const diskSize = size * 0.58;
    this.tiles.drawDisk(context, x - size * 0.01, y + size * 0.2, diskSize, true);
    this.tiles.drawDisk(context, x + size * 0.43, y + size * 0.2, diskSize, true);
  }
}

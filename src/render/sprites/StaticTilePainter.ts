import { Tile } from '../../game/types';

const TAU = Math.PI * 2;

/** Paints and caches non-animated cell surfaces. */
export class StaticTilePainter {
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private dpr = 1;

  public setDevicePixelRatio(dpr: number): void {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.cache.clear();
  }

  public clear(): void {
    this.cache.clear();
  }

  public drawCellUnderlay(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    context.fillStyle = '#050d17';
    context.fillRect(x, y, size + 0.3, size + 0.3);
    context.strokeStyle = 'rgba(72, 198, 232, 0.035)';
    context.lineWidth = Math.max(0.5, size * 0.012);
    context.strokeRect(x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84);
    const dot = size * 0.035;
    context.fillStyle = 'rgba(76, 226, 255, 0.09)';
    context.fillRect(x + size * 0.15, y + size * 0.15, dot, dot);
    context.fillRect(x + size * 0.82, y + size * 0.82, dot, dot);
  }

  public drawCachedCellUnderlay(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    const pixelSize = this.pixelSize(size);
    const key = `underlay:${pixelSize}`;
    let cached = this.cache.get(key);
    if (cached === undefined) {
      const created = this.createCache(pixelSize, size, (cacheContext) => {
        this.drawCellUnderlay(cacheContext, 0, 0, size);
      });
      if (created === null) return;
      this.cache.set(key, created);
      cached = created;
    }
    context.drawImage(cached, x, y, size, size);
  }

  public drawStaticTile(
    context: CanvasRenderingContext2D,
    tile: Tile.Dirt | Tile.Steel | Tile.Carbon | Tile.Wall,
    x: number,
    y: number,
    size: number,
  ): void {
    const pixelSize = this.pixelSize(size);
    const key = `${tile}:${pixelSize}`;
    let cached = this.cache.get(key);
    if (cached === undefined) {
      const created = this.createCache(pixelSize, size, (cacheContext) => {
        this.drawCellUnderlay(cacheContext, 0, 0, size);
        if (tile === Tile.Dirt) this.drawDirt(cacheContext, 0, 0, size);
        else if (tile === Tile.Steel) this.drawSteel(cacheContext, 0, 0, size);
        else if (tile === Tile.Carbon) this.drawCarbon(cacheContext, 0, 0, size);
        else this.drawWall(cacheContext, 0, 0, size);
      });
      if (created === null) return;
      this.cache.set(key, created);
      cached = created;
    }
    context.drawImage(cached, x, y, size, size);
  }

  private pixelSize(size: number): number {
    return Math.max(8, Math.round((size * this.dpr) / 4) * 4);
  }

  private createCache(
    pixelSize: number,
    logicalSize: number,
    paint: (context: CanvasRenderingContext2D) => void,
  ): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const context = canvas.getContext('2d');
    if (context === null) return null;
    const scale = pixelSize / logicalSize;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    paint(context);
    return canvas;
  }

  private drawDirt(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const inset = size * 0.035;
    const gradient = context.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, '#172128');
    gradient.addColorStop(0.45, '#0f181f');
    gradient.addColorStop(1, '#091117');
    context.fillStyle = gradient;
    context.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    context.strokeStyle = 'rgba(94, 126, 133, 0.09)';
    context.lineWidth = size * 0.025;
    context.beginPath();
    context.moveTo(x + size * 0.18, y + size * 0.66);
    context.lineTo(x + size * 0.45, y + size * 0.38);
    context.lineTo(x + size * 0.8, y + size * 0.7);
    context.moveTo(x + size * 0.45, y + size * 0.38);
    context.lineTo(x + size * 0.56, y + size * 0.18);
    context.stroke();
    context.fillStyle = 'rgba(48, 133, 147, 0.08)';
    context.beginPath();
    context.arc(x + size * 0.72, y + size * 0.22, size * 0.035, 0, TAU);
    context.fill();
  }

  private drawSteel(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const gradient = context.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, '#304755');
    gradient.addColorStop(0.16, '#162b39');
    gradient.addColorStop(0.5, '#091722');
    gradient.addColorStop(0.84, '#132735');
    gradient.addColorStop(1, '#2b414f');
    context.fillStyle = gradient;
    context.fillRect(x, y, size, size);
    context.strokeStyle = 'rgba(85, 190, 213, 0.16)';
    context.lineWidth = size * 0.018;
    context.strokeRect(x + size * 0.025, y + size * 0.025, size * 0.95, size * 0.95);
    context.strokeStyle = 'rgba(106, 230, 255, 0.28)';
    context.lineWidth = size * 0.038;
    context.strokeRect(x + size * 0.09, y + size * 0.09, size * 0.82, size * 0.82);
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.lineWidth = size * 0.018;
    context.beginPath();
    context.moveTo(x + size * 0.15, y + size * 0.18);
    context.lineTo(x + size * 0.85, y + size * 0.18);
    context.moveTo(x + size * 0.15, y + size * 0.82);
    context.lineTo(x + size * 0.85, y + size * 0.82);
    context.stroke();
    context.fillStyle = '#82dff1';
    for (const [dx, dy] of [
      [0.18, 0.18],
      [0.82, 0.18],
      [0.18, 0.82],
      [0.82, 0.82],
    ] as const) {
      context.beginPath();
      context.arc(x + size * dx, y + size * dy, size * 0.025, 0, TAU);
      context.fill();
    }
  }

  private drawCarbon(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const surface = context.createLinearGradient(x, y, x, y + size);
    surface.addColorStop(0, '#242a2e');
    surface.addColorStop(0.5, '#0b1117');
    surface.addColorStop(1, '#1c2328');
    context.fillStyle = surface;
    context.fillRect(x, y, size, size);
    context.strokeStyle = 'rgba(163, 124, 78, 0.38)';
    context.lineWidth = size * 0.022;
    context.strokeRect(x + size * 0.055, y + size * 0.055, size * 0.89, size * 0.89);
    const panelSize = size * 0.32;
    for (const [offsetX, offsetY] of [
      [0.11, 0.11],
      [0.57, 0.11],
      [0.11, 0.57],
      [0.57, 0.57],
    ] as const) {
      context.fillStyle = '#101820';
      context.fillRect(x + size * offsetX, y + size * offsetY, panelSize, panelSize);
      context.strokeStyle = 'rgba(119, 135, 139, 0.2)';
      context.lineWidth = size * 0.014;
      context.strokeRect(x + size * offsetX, y + size * offsetY, panelSize, panelSize);
    }
    context.fillStyle = '#44382d';
    context.fillRect(x + size * 0.44, y + size * 0.08, size * 0.12, size * 0.84);
    context.fillRect(x + size * 0.08, y + size * 0.44, size * 0.84, size * 0.12);
    context.strokeStyle = 'rgba(188, 142, 86, 0.48)';
    context.lineWidth = size * 0.018;
    context.strokeRect(x + size * 0.455, y + size * 0.455, size * 0.09, size * 0.09);
  }

  private drawWall(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const outerRadius = size * 0.18;
    const innerRadius = size * 0.12;
    context.fillStyle = '#101b2d';
    context.beginPath();
    context.roundRect(x + size * 0.04, y + size * 0.04, size * 0.92, size * 0.92, outerRadius);
    context.fill();
    const hue = '145, 105, 255';
    context.strokeStyle = `rgba(${hue}, 0.55)`;
    context.lineWidth = size * 0.04;
    context.beginPath();
    context.roundRect(x + size * 0.12, y + size * 0.12, size * 0.76, size * 0.76, innerRadius);
    context.stroke();
    context.strokeStyle = `rgba(${hue}, 0.28)`;
    context.lineWidth = size * 0.026;
    context.beginPath();
    context.moveTo(x + size * 0.12, y + size * 0.5);
    context.lineTo(x + size * 0.34, y + size * 0.5);
    context.lineTo(x + size * 0.5, y + size * 0.34);
    context.lineTo(x + size * 0.66, y + size * 0.5);
    context.lineTo(x + size * 0.88, y + size * 0.5);
    context.stroke();
    context.fillStyle = `rgba(${hue}, 0.55)`;
    context.fillRect(x + size * 0.46, y + size * 0.46, size * 0.08, size * 0.08);
  }
}

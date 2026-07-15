import { Tile, type Direction } from '../game/types';
import { EntityPainter } from './sprites/EntityPainter';
import { StaticTilePainter } from './sprites/StaticTilePainter';

/** Routes tile kinds to focused static and animated sprite painters. */
export class TilePainter {
  private readonly staticTiles = new StaticTilePainter();
  private readonly entities = new EntityPainter();

  public beginFrame(time: number, dpr: number): void {
    this.entities.setTime(time);
    this.staticTiles.setDevicePixelRatio(dpr);
  }

  public clearCache(): void {
    this.staticTiles.clear();
  }

  public drawCellUnderlay(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    this.staticTiles.drawCellUnderlay(context, x, y, size);
  }

  public drawCachedCellUnderlay(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ): void {
    this.staticTiles.drawCachedCellUnderlay(context, x, y, size);
  }

  public drawStaticTile(
    context: CanvasRenderingContext2D,
    tile: Tile.Dirt | Tile.Steel | Tile.Carbon | Tile.Wall,
    x: number,
    y: number,
    size: number,
  ): void {
    this.staticTiles.drawStaticTile(context, tile, x, y, size);
  }

  public drawTile(
    context: CanvasRenderingContext2D,
    tile: Tile,
    x: number,
    y: number,
    size: number,
    gridX: number,
    gridY: number,
    enemyAngle = 0,
  ): void {
    if (
      tile === Tile.Dirt ||
      tile === Tile.Steel ||
      tile === Tile.Carbon ||
      tile === Tile.Wall
    ) {
      this.staticTiles.drawStaticTile(context, tile, x, y, size);
      return;
    }
    switch (tile) {
      case Tile.Infotron:
        this.entities.drawInfotron(context, x, y, size, gridX + gridY);
        break;
      case Tile.Zonk:
        this.entities.drawZonk(context, x, y, size, gridX + gridY);
        break;
      case Tile.ExitClosed:
      case Tile.ExitOpen:
        this.entities.drawExit(context, x, y, size, tile === Tile.ExitOpen);
        break;
      case Tile.Enemy:
        this.entities.drawEnemy(context, x, y, size, gridX + gridY, enemyAngle);
        break;
      case Tile.Disk:
      case Tile.Bomb:
        this.entities.drawDisk(context, x, y, size, tile === Tile.Bomb);
        break;
      case Tile.Explosion:
        this.entities.drawExplosion(context, x, y, size, gridX + gridY);
        break;
      case Tile.Empty:
        break;
    }
  }

  public drawCarrier(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
    facing: Direction,
    stretchX = 1,
    stretchY = 1,
  ): void {
    this.entities.drawCarrier(context, centerX, centerY, size, facing, stretchX, stretchY);
  }

  public drawZonk(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    phase: number,
  ): void {
    this.entities.drawZonk(context, x, y, size, phase);
  }

  public drawDisk(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    armed: boolean,
  ): void {
    this.entities.drawDisk(context, x, y, size, armed);
  }

  public drawExit(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    open: boolean,
  ): void {
    this.entities.drawExit(context, x, y, size, open);
  }
}

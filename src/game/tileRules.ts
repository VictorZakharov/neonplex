import { Tile } from './types';

export const initializeTiles = (
  tiles: readonly Tile[],
  requiredInfotrons: number,
): Tile[] =>
  tiles.map((tile) =>
    requiredInfotrons === 0 && tile === Tile.ExitClosed ? Tile.ExitOpen : tile,
  );

export const isRoundedSupport = (tile: Tile): boolean =>
  tile === Tile.Zonk || tile === Tile.Infotron || tile === Tile.Wall;

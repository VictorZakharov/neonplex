import { Tile, type Direction, type LevelDefinition, type Point } from './types';
import type { ParsedLevel } from './internalTypes';

export type { ParsedLevel } from './internalTypes';

const LEGEND: Readonly<Record<string, Tile>> = {
  ' ': Tile.Empty,
  '.': Tile.Dirt,
  '#': Tile.Steel,
  X: Tile.Carbon,
  W: Tile.Wall,
  I: Tile.Infotron,
  O: Tile.Zonk,
  E: Tile.ExitClosed,
  S: Tile.Enemy,
  D: Tile.Disk,
};

export const parseLevel = (definition: LevelDefinition): ParsedLevel => {
  if (definition.map.length < 3) {
    throw new Error(`Level "${definition.id}" must contain at least three rows.`);
  }
  const width = definition.map[0]?.length ?? 0;
  if (width < 3 || definition.map.some((row) => row.length !== width)) {
    throw new Error(`Level "${definition.id}" must be a rectangular grid.`);
  }

  const tiles: Tile[] = [];
  const enemies = new Map<number, Direction>();
  let spawn: Point | null = null;
  let required = 0;
  let exitCount = 0;

  definition.map.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      if (symbol === '@') {
        if (spawn !== null) {
          throw new Error(`Level "${definition.id}" has more than one player spawn.`);
        }
        spawn = { x, y };
        tiles.push(Tile.Empty);
        return;
      }
      const tile = LEGEND[symbol];
      if (tile === undefined) {
        throw new Error(`Level "${definition.id}" contains unknown tile "${symbol}".`);
      }
      if (tile === Tile.Infotron) required += 1;
      if (tile === Tile.ExitClosed) exitCount += 1;
      if (tile === Tile.Enemy) enemies.set(y * width + x, 'right');
      tiles.push(tile);
    });
  });

  if (spawn === null || exitCount !== 1) {
    throw new Error(`Level "${definition.id}" requires one spawn and exactly one exit.`);
  }
  return {
    width,
    height: definition.map.length,
    tiles,
    spawn,
    required,
    enemies,
  };
};

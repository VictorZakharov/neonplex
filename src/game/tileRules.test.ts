import { initializeTiles, isRoundedSupport } from './tileRules';
import { Tile } from './types';

describe('tile rules', () => {
  it('opens a zero-objective exit while preserving the source tiles', () => {
    const source = [Tile.Steel, Tile.ExitClosed, Tile.Empty];

    expect(initializeTiles(source, 0)).toEqual([
      Tile.Steel,
      Tile.ExitOpen,
      Tile.Empty,
    ]);
    expect(source[1]).toBe(Tile.ExitClosed);
  });

  it('keeps exits locked while Infotrons remain', () => {
    expect(initializeTiles([Tile.ExitClosed], 1)).toEqual([Tile.ExitClosed]);
  });

  it.each([
    [Tile.Zonk, true],
    [Tile.Infotron, true],
    [Tile.Wall, true],
    [Tile.Steel, false],
    [Tile.Carbon, false],
  ] as const)('classifies rounded support tile %s', (tile, expected) => {
    expect(isRoundedSupport(tile)).toBe(expected);
  });
});

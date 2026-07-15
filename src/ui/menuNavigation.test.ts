import { menuNavigationIndex, menuNavigationIntent } from './menuNavigation';

describe('menuNavigationIntent', () => {
  it.each([
    ['ArrowUp', 'previous'],
    ['KeyA', 'previous'],
    ['ArrowDown', 'next'],
    ['KeyD', 'next'],
    ['Home', 'first'],
    ['End', 'last'],
    ['Enter', 'activate'],
    ['Space', 'activate'],
  ] as const)('maps %s to %s', (key, intent) => {
    expect(menuNavigationIntent(key)).toBe(intent);
  });

  it('leaves unrelated shortcuts untouched', () => {
    expect(menuNavigationIntent('Escape')).toBeNull();
    expect(menuNavigationIntent('KeyR')).toBeNull();
  });
});

describe('menuNavigationIndex', () => {
  it('wraps in both directions', () => {
    expect(menuNavigationIndex(0, 4, 'previous')).toBe(3);
    expect(menuNavigationIndex(3, 4, 'next')).toBe(0);
  });

  it('supports first and last navigation', () => {
    expect(menuNavigationIndex(2, 4, 'first')).toBe(0);
    expect(menuNavigationIndex(1, 4, 'last')).toBe(3);
  });
});

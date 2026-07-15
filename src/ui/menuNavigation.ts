export type MenuNavigationIntent = 'previous' | 'next' | 'first' | 'last' | 'activate';

const MENU_KEY_INTENTS: Readonly<Record<string, MenuNavigationIntent>> = {
  ArrowLeft: 'previous',
  ArrowUp: 'previous',
  KeyA: 'previous',
  KeyW: 'previous',
  ArrowRight: 'next',
  ArrowDown: 'next',
  KeyD: 'next',
  KeyS: 'next',
  Home: 'first',
  End: 'last',
  Enter: 'activate',
  Space: 'activate',
};

export const menuNavigationIntent = (code: string): MenuNavigationIntent | null =>
  MENU_KEY_INTENTS[code] ?? null;

export const menuNavigationIndex = (
  currentIndex: number,
  itemCount: number,
  intent: Exclude<MenuNavigationIntent, 'activate'>,
): number => {
  if (itemCount <= 0) return -1;
  const safeIndex = Math.max(0, Math.min(itemCount - 1, currentIndex));
  if (intent === 'first') return 0;
  if (intent === 'last') return itemCount - 1;
  if (intent === 'previous') return (safeIndex - 1 + itemCount) % itemCount;
  return (safeIndex + 1) % itemCount;
};

import type { EdgeIndicator, ScreenPoint, Viewport } from './renderTypes';

export type { EdgeIndicator, ScreenPoint } from './renderTypes';

export const offscreenEdgeIndicator = (
  target: ScreenPoint,
  viewport: Viewport,
  targetHalfSize: number,
  requestedInset: number,
): EdgeIndicator | null => {
  const halfSize = Math.max(0, targetHalfSize);
  if (
    target.x + halfSize > 0 &&
    target.x - halfSize < viewport.width &&
    target.y + halfSize > 0 &&
    target.y - halfSize < viewport.height
  ) {
    return null;
  }

  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const dx = target.x - centerX;
  const dy = target.y - centerY;
  const inset = Math.min(
    Math.max(0, requestedInset),
    Math.min(viewport.width, viewport.height) * 0.25,
  );
  const halfWidth = Math.max(1, centerX - inset);
  const halfHeight = Math.max(1, centerY - inset);
  const divisor = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
  const scale = divisor > 0 ? 1 / divisor : 0;
  return {
    position: { x: centerX + dx * scale, y: centerY + dy * scale },
    angle: Math.atan2(dy, dx),
  };
};

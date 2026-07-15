import type { Direction } from '../game/types';

export interface InputCallbacks {
  readonly onPause: () => void;
  readonly onRestart: () => void;
  readonly onRestartHint: () => void;
  readonly onUserGesture: () => void;
}

export interface VirtualJoystickCallbacks {
  readonly onDirectionChange: (direction: Direction | null) => void;
  readonly onUserGesture: () => void;
}

export interface JoystickState {
  readonly direction: Direction | null;
  readonly offsetX: number;
  readonly offsetY: number;
}

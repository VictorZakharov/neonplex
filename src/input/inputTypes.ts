export interface InputCallbacks {
  readonly onPause: () => void;
  readonly onRestart: () => void;
  readonly onRestartHint: () => void;
  readonly onUserGesture: () => void;
}

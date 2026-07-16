const COARSE_POINTER_QUERY = '(any-pointer: coarse)';

/** Requests one immersive gameplay session from a touch-initiated entry. */
export class FullscreenController {
  private attempted = false;
  private pendingRequest: Promise<boolean> | null = null;

  public constructor(
    private readonly documentRef?: Document,
    private readonly windowRef?: Window,
  ) {}

  public requestForGameplay(touchInitiated: boolean): Promise<boolean> {
    const documentRef =
      this.documentRef ?? (typeof document === 'undefined' ? null : document);
    const windowRef =
      this.windowRef ?? (typeof window === 'undefined' ? null : window);
    if (
      !touchInitiated ||
      documentRef === null ||
      windowRef === null ||
      !this.isTouchCapable(windowRef)
    ) {
      return Promise.resolve(false);
    }
    if (
      documentRef.fullscreenElement !== null &&
      documentRef.fullscreenElement !== undefined
    ) {
      return Promise.resolve(true);
    }
    if (documentRef.fullscreenEnabled === false) return Promise.resolve(false);
    if (this.pendingRequest !== null) return this.pendingRequest;
    if (this.attempted) return Promise.resolve(false);

    const target = documentRef.documentElement;
    if (typeof target.requestFullscreen !== 'function') {
      return Promise.resolve(false);
    }

    this.attempted = true;
    try {
      this.pendingRequest = target
        .requestFullscreen({ navigationUI: 'hide' })
        .then(
          () => true,
          () => false,
        )
        .finally(() => {
          this.pendingRequest = null;
        });
      return this.pendingRequest;
    } catch {
      return Promise.resolve(false);
    }
  }

  private isTouchCapable(windowRef: Window): boolean {
    const hasCoarsePointer =
      typeof windowRef.matchMedia === 'function' &&
      windowRef.matchMedia(COARSE_POINTER_QUERY).matches;
    return hasCoarsePointer || windowRef.navigator.maxTouchPoints > 0;
  }
}

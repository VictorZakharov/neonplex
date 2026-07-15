/** Visible canvas options favor compositor-stable presentation over front-buffer latency. */
export const MAIN_CANVAS_CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = Object.freeze({
  alpha: false,
});

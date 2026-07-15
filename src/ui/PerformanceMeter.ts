import type { PerformanceElements } from './uiTypes';

const requireElement = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`Required performance element not found: ${selector}`);
  return element;
};

/** Samples frame pacing without allocating or updating the DOM every frame. */
export class PerformanceMeter {
  private statsElapsed = 0;
  private statsFrames = 0;
  private smoothedFrameMs = 16.67;
  private smoothedDrawMs = 0;
  private visible = true;
  private readonly frameTimeSamples: number[] = [];
  private readonly elements: PerformanceElements;

  public constructor(root: HTMLElement) {
    this.elements = {
      meter: requireElement(root, '#performance-meter'),
      fps: requireElement(root, '#perf-fps'),
      lowFps: requireElement(root, '#perf-low'),
      frameTime: requireElement(root, '#perf-frame'),
      drawTime: requireElement(root, '#perf-draw'),
    };
  }

  public update(rawDeltaSeconds: number, drawMs: number): void {
    if (!this.visible) return;
    if (rawDeltaSeconds <= 0 || rawDeltaSeconds > 0.25) {
      this.resetWindow();
      return;
    }
    const frameMs = rawDeltaSeconds * 1000;
    this.smoothedFrameMs += (frameMs - this.smoothedFrameMs) * 0.08;
    this.smoothedDrawMs += (drawMs - this.smoothedDrawMs) * 0.12;
    this.statsElapsed += rawDeltaSeconds;
    this.statsFrames += 1;
    this.frameTimeSamples.push(frameMs);
    if (this.statsElapsed < 0.75) return;

    const fps = this.statsFrames / this.statsElapsed;
    const sortedFrameTimes = [...this.frameTimeSamples].sort((left, right) => left - right);
    const percentileIndex = Math.min(
      sortedFrameTimes.length - 1,
      Math.max(0, Math.ceil(sortedFrameTimes.length * 0.99) - 1),
    );
    const percentileFrameMs = sortedFrameTimes[percentileIndex] ?? this.smoothedFrameMs;
    const lowFps = 1000 / Math.max(0.1, percentileFrameMs);
    this.elements.fps.textContent = Math.round(fps).toString();
    this.elements.lowFps.textContent = Math.round(lowFps).toString();
    this.elements.frameTime.textContent = `${this.smoothedFrameMs.toFixed(1)} ms`;
    this.elements.drawTime.textContent = `${this.smoothedDrawMs.toFixed(1)} ms`;
    this.elements.meter.dataset.health = fps >= 55 ? 'good' : fps >= 40 ? 'warn' : 'bad';
    this.elements.meter.setAttribute(
      'aria-label',
      `${Math.round(fps)} frames per second, ${Math.round(lowFps)} one-percent-low frames per second, ${this.smoothedFrameMs.toFixed(1)} millisecond frame time, ${this.smoothedDrawMs.toFixed(1)} millisecond draw time`,
    );
    this.resetWindow();
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.elements.meter.dataset.visible = visible ? 'true' : 'false';
    this.elements.meter.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (!visible) this.resetWindow();
  }

  private resetWindow(): void {
    this.statsElapsed = 0;
    this.statsFrames = 0;
    this.frameTimeSamples.length = 0;
  }
}

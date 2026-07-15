import type { GameEvent } from '../game/types';
import type {
  BoardLayout,
  Particle,
  ParticleConfig,
  ScreenShakeOffset,
  Viewport,
} from './renderTypes';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 360;
const hash = (x: number, y: number): number => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/** Owns cached screen surfaces, transient particles, shake and flash. */
export class ScreenEffectsRenderer {
  private readonly particles: Particle[] = [];
  private viewport: Viewport = { width: 1, height: 1 };
  private dpr = 1;
  private shake = 0;
  private flash = 0;
  private backdropCache: HTMLCanvasElement | null = null;
  private postProcessingCache: HTMLCanvasElement | null = null;

  public constructor(private readonly reducedMotion: MediaQueryList) {}

  public resize(viewport: Viewport, dpr: number): void {
    if (
      viewport.width === this.viewport.width &&
      viewport.height === this.viewport.height &&
      dpr === this.dpr
    ) {
      return;
    }
    this.viewport = viewport;
    this.dpr = dpr;
    this.backdropCache = null;
    this.postProcessingCache = null;
  }

  public reset(): void {
    this.particles.length = 0;
    this.shake = 0;
    this.flash = 0;
  }

  public update(delta: number, events: readonly GameEvent[]): void {
    this.handleEvents(events);
    this.updateParticles(delta);
    this.shake = Math.max(0, this.shake - delta * 3.8);
    this.flash = Math.max(0, this.flash - delta * 2.7);
  }

  public shakeOffset(time: number, tileSize: number): ScreenShakeOffset {
    const amount = this.reducedMotion.matches ? 0 : this.shake * tileSize * 0.14;
    return {
      x: Math.sin(time * 83) * amount,
      y: Math.cos(time * 67) * amount * 0.72,
    };
  }

  public drawBackdrop(context: CanvasRenderingContext2D): void {
    if (this.backdropCache === null) this.backdropCache = this.buildBackdropCache();
    if (this.backdropCache !== null) {
      context.drawImage(this.backdropCache, 0, 0, this.viewport.width, this.viewport.height);
      return;
    }
    context.fillStyle = '#02050b';
    context.fillRect(0, 0, this.viewport.width, this.viewport.height);
  }

  public drawParticles(context: CanvasRenderingContext2D, layout: BoardLayout): void {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      const x = layout.left + particle.x * layout.tile;
      const y = layout.top + particle.y * layout.tile;
      context.fillStyle = particle.color;
      context.globalAlpha = alpha * 0.16;
      context.beginPath();
      context.arc(x, y, layout.tile * particle.size * (1.6 + alpha), 0, TAU);
      context.fill();
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x, y, layout.tile * particle.size * (0.35 + alpha * 0.5), 0, TAU);
      context.fill();
    }
    context.restore();
  }

  public drawPostProcessing(context: CanvasRenderingContext2D): void {
    context.save();
    if (this.postProcessingCache === null) {
      this.postProcessingCache = this.buildPostProcessingCache();
    }
    if (this.postProcessingCache !== null) {
      context.drawImage(
        this.postProcessingCache,
        0,
        0,
        this.viewport.width,
        this.viewport.height,
      );
    }
    if (this.flash > 0 && !this.reducedMotion.matches) {
      context.fillStyle = `rgba(144, 241, 255, ${Math.min(0.46, this.flash * 0.3)})`;
      context.fillRect(0, 0, this.viewport.width, this.viewport.height);
    }
    context.restore();
  }

  private buildBackdropCache(): HTMLCanvasElement | null {
    const canvas = this.createScreenCanvas();
    const context = canvas.getContext('2d');
    if (context === null) return null;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { width, height } = this.viewport;
    const gradient = context.createRadialGradient(
      width * 0.5,
      height * 0.44,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.8,
    );
    gradient.addColorStop(0, '#11263b');
    gradient.addColorStop(0.42, '#07111e');
    gradient.addColorStop(1, '#02050b');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const spacing = 44;
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(63, 211, 255, 0.045)';
    context.beginPath();
    for (let x = -spacing; x < width + spacing; x += spacing) {
      context.moveTo(x, 0);
      context.lineTo(x - height * 0.22, height);
    }
    for (let y = 0; y < height; y += spacing) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();

    for (let index = 0; index < 18; index += 1) {
      const x = hash(index, 5) * width;
      const y = hash(index, 11) * height;
      const opacity = 0.16 + hash(index, 19) * 0.2;
      context.fillStyle = `rgba(82, 221, 255, ${opacity})`;
      context.fillRect(x, y, 1.2, 1.2);
    }
    return canvas;
  }

  private buildPostProcessingCache(): HTMLCanvasElement | null {
    const canvas = this.createScreenCanvas();
    const context = canvas.getContext('2d');
    if (context === null) return null;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { width, height } = this.viewport;
    context.globalAlpha = 0.11;
    context.fillStyle = '#000000';
    for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
    context.globalAlpha = 1;
    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.72, 'rgba(0,0,0,0.1)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.68)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
    return canvas;
  }

  private createScreenCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(this.viewport.width * this.dpr));
    canvas.height = Math.max(1, Math.round(this.viewport.height * this.dpr));
    return canvas;
  }

  private handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      const intensity = event.intensity ?? 0.5;
      if (event.type === 'impact') {
        this.shake = Math.max(this.shake, intensity * 0.35);
      }
      if (event.type === 'explode' || event.type === 'death') {
        this.shake = Math.max(this.shake, intensity);
        this.flash = Math.max(this.flash, intensity * 0.65);
      }
      if (event.type === 'win' || event.type === 'exit-open') {
        this.flash = Math.max(this.flash, 0.34);
      }

      const config = this.particleConfig(event.type);
      if (config === null || this.reducedMotion.matches) continue;
      const count = Math.round(config.count * Math.min(1.4, intensity));
      for (let index = 0; index < count; index += 1) {
        if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
        const angle = Math.random() * TAU;
        const speed = config.speed * (0.35 + Math.random() * 0.8);
        const life = config.life * (0.7 + Math.random() * 0.55);
        this.particles.push({
          x: event.position.x + 0.5,
          y: event.position.y + 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - config.lift,
          life,
          maxLife: life,
          size: config.size * (0.5 + Math.random()),
          color: config.colors[Math.floor(Math.random() * config.colors.length)] ?? '#ffffff',
          drag: config.drag,
        });
      }
    }
  }

  private particleConfig(type: GameEvent['type']): ParticleConfig | null {
    switch (type) {
      case 'dig':
        return { count: 7, speed: 1.6, lift: 0.2, life: 0.42, size: 0.08, drag: 4, colors: ['#8ca4ac', '#406579', '#54d9e6'] };
      case 'collect':
        return { count: 22, speed: 2.4, lift: 0.4, life: 0.72, size: 0.075, drag: 2.5, colors: ['#ffffff', '#67f6ff', '#4a8dff'] };
      case 'disk-pickup':
      case 'disk-deploy':
        return { count: 14, speed: 1.7, lift: 0.2, life: 0.52, size: 0.07, drag: 3, colors: ['#fff7a1', '#ffc94e', '#ff6d5a'] };
      case 'impact':
      case 'push':
        return { count: 9, speed: 1.2, lift: 0.15, life: 0.38, size: 0.055, drag: 4, colors: ['#e0edf3', '#7f9aa8', '#43e0ff'] };
      case 'explode':
      case 'death':
        return { count: 62, speed: 4.5, lift: 0.3, life: 0.86, size: 0.11, drag: 1.8, colors: ['#ffffff', '#78f5ff', '#8d5cff', '#ff3d9f'] };
      case 'exit-open':
      case 'win':
        return { count: 38, speed: 2.9, lift: 0.8, life: 1.1, size: 0.08, drag: 1.7, colors: ['#ffffff', '#5effc6', '#4de6ff'] };
      case 'move':
      case 'enemy':
        return null;
    }
  }

  private updateParticles(delta: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      if (particle === undefined) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }
      const drag = Math.exp(-particle.drag * delta);
      particle.vx *= drag;
      particle.vy = particle.vy * drag + delta * 1.2;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }
  }
}

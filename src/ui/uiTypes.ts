import type { IntelPreviewKind } from '../render/renderTypes';

export interface HudElements {
  readonly sector: HTMLElement;
  readonly level: HTMLElement;
  readonly collected: HTMLElement;
  readonly required: HTMLElement;
  readonly score: HTMLElement;
  readonly time: HTMLElement;
  readonly disks: HTMLElement;
  readonly progress: HTMLElement;
  readonly objective: HTMLElement;
}

export interface IntelItem {
  readonly icon: IntelPreviewKind;
  readonly name: string;
  readonly description: string;
  readonly danger?: boolean;
}

export interface LevelIntel {
  readonly heading: string;
  readonly summary: string;
  readonly items: readonly IntelItem[];
}

export interface LevelIntelMarkup {
  readonly levelIndex: number;
  readonly html: string;
}

export interface PerformanceElements {
  readonly meter: HTMLElement;
  readonly fps: HTMLElement;
  readonly lowFps: HTMLElement;
  readonly frameTime: HTMLElement;
  readonly drawTime: HTMLElement;
}

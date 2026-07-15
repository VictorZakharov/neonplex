import { AudioEngine } from '../audio/AudioEngine';
import { GameEngine } from '../game/GameEngine';
import { LEVELS } from '../game/levels';
import type { GameEvent, GamePhase, GameSnapshot } from '../game/types';
import { InputManager } from '../input/InputManager';
import { Renderer, type IntelPreviewKind } from '../render/Renderer';
import { appTemplate } from './appTemplate';
import { formatTime } from './formatTime';
import {
  isAudioMuted,
  isPerformanceVisible,
  saveAudioEnabled,
  saveBestScore,
  savePerformanceVisible,
} from './localState';
import {
  levelIntelTemplate,
  lostMenuTemplate,
  mainMenuTemplate,
  pauseMenuTemplate,
  winMenuTemplate,
} from './menuTemplates';
import { menuNavigationIndex, menuNavigationIntent } from './menuNavigation';
import { PerformanceMeter } from './PerformanceMeter';
import type { HudElements } from './uiTypes';

const FIXED_STEP = 1 / 60;
const MAX_STEPS = 6;

export class App {
  private readonly abortController = new AbortController();
  private readonly audio = new AudioEngine();
  private renderer: Renderer | null = null;
  private input: InputManager | null = null;
  private engine: GameEngine | null = null;
  private hud: HudElements | null = null;
  private modal: HTMLElement | null = null;
  private modalContent: HTMLElement | null = null;
  private liveRegion: HTMLElement | null = null;
  private briefing: HTMLElement | null = null;
  private restartFeedback: HTMLElement | null = null;
  private restartMessage: HTMLElement | null = null;
  private actionFeedback: HTMLElement | null = null;
  private soundButton: HTMLButtonElement | null = null;
  private performance: PerformanceMeter | null = null;
  private performanceVisible = true;
  private activeLevel = 0;
  private previousPhase: GamePhase = 'ready';
  private frameHandle = 0;
  private briefingTimer = 0;
  private restartHintTimer = 0;
  private lastFrameTime = 0;
  private accumulator = 0;
  private lastHudSignature = '';
  private mounted = false;

  public constructor(private readonly root: HTMLElement) {}

  public mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.root.innerHTML = appTemplate();

    const canvas = this.requireElement<HTMLCanvasElement>('#game-canvas');
    const minimapCanvas = this.requireElement<HTMLCanvasElement>('#minimap-canvas');
    const minimapZoom = this.requireElement('#minimap-zoom');
    const touchZoom = this.requireElement('#touch-zoom-label');
    this.modal = this.requireElement('#modal');
    this.modalContent = this.requireElement('#modal-content');
    this.liveRegion = this.requireElement('#live-region');
    this.briefing = this.requireElement('#briefing');
    this.restartFeedback = this.requireElement('#restart-feedback');
    this.restartMessage = this.requireElement('#restart-message');
    this.actionFeedback = this.requireElement('#action-feedback');
    this.soundButton = this.requireElement<HTMLButtonElement>('#sound-toggle');
    this.performance = new PerformanceMeter(this.root);
    this.performanceVisible = isPerformanceVisible();
    this.performance.setVisible(this.performanceVisible);
    this.hud = {
      sector: this.requireElement('#hud-sector'),
      level: this.requireElement('#hud-level'),
      collected: this.requireElement('#hud-collected'),
      required: this.requireElement('#hud-required'),
      score: this.requireElement('#hud-score'),
      time: this.requireElement('#hud-time'),
      disks: this.requireElement('#hud-disks'),
      progress: this.requireElement('#hud-progress'),
      objective: this.requireElement('#hud-objective'),
    };

    this.input = new InputManager(this.root, {
      onPause: () => this.togglePause(),
      onRestart: () => this.restart(),
      onRestartHint: () => this.showRestartHint(),
      onPlayerStep: (direction) => this.engine?.queuePlayerStep(direction) ?? false,
      onCancelPlayerSteps: () => this.engine?.cancelPlayerSteps(),
      onUserGesture: () => {
        void this.audio.activate().catch(() => undefined);
      },
    });
    this.renderer = new Renderer(canvas, minimapCanvas, [minimapZoom, touchZoom], {
      onPlayerStep: (direction) => this.input?.queuePlayerStep(direction) ?? false,
      onPlayerDragEnd: () => this.input?.endPlayerDrag(),
      onTravelTarget: (target) => this.input?.queueTravelTarget(target),
      onCancelTravel: () => this.input?.cancelTravel(),
      onUserGesture: () => {
        void this.audio.activate().catch(() => undefined);
      },
    });
    this.input.mount();
    this.root.addEventListener('click', this.onClick, { signal: this.abortController.signal });
    this.root.addEventListener('keydown', this.onMenuKeyDown, { signal: this.abortController.signal });
    window.addEventListener('beforeunload', this.dispose, { signal: this.abortController.signal });

    this.loadAudioSetting();
    this.engine = this.createEngine(0);
    this.showMainMenu();
    this.lastFrameTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  public readonly dispose = (): void => {
    if (!this.mounted) return;
    this.mounted = false;
    cancelAnimationFrame(this.frameHandle);
    window.clearTimeout(this.briefingTimer);
    window.clearTimeout(this.restartHintTimer);
    this.abortController.abort();
    this.input?.dispose();
    this.renderer?.dispose();
    this.audio.dispose();
  };

  private readonly frame = (timestamp: number): void => {
    if (!this.mounted || this.engine === null || this.renderer === null || this.input === null) return;
    const rawDelta = Math.max(0, (timestamp - this.lastFrameTime) / 1000);
    const delta = Math.min(0.1, rawDelta);
    this.lastFrameTime = timestamp;
    this.updateRestartFeedback(this.input.getRestartHoldProgress(timestamp));
    this.accumulator += delta;
    const events: GameEvent[] = [];
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS) {
      this.engine.update(FIXED_STEP, this.input.consumeFrame());
      events.push(...this.engine.consumeEvents());
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    for (const event of events) this.audio.play(event);
    const snapshot = this.engine.getSnapshot();
    this.updateActionFeedback(this.input.getActionHoldProgress(timestamp), snapshot);
    const renderLeadSeconds =
      snapshot.phase === 'paused' || snapshot.phase === 'ready' ? 0 : this.accumulator;
    const drawStartedAt = performance.now();
    this.renderer.render(snapshot, delta, events, renderLeadSeconds);
    this.positionGameplayFeedback();
    const drawMs = performance.now() - drawStartedAt;
    this.performance?.update(rawDelta, drawMs);
    this.updateHud(snapshot);
    this.handlePhaseChange(snapshot);
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private createEngine(levelIndex: number): GameEngine {
    const definition = LEVELS[levelIndex];
    if (definition === undefined) throw new Error(`Unknown level ${levelIndex}.`);
    return new GameEngine(definition, levelIndex);
  }

  private beginLevel(levelIndex: number): void {
    const safeIndex = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    const definition = LEVELS[safeIndex];
    if (definition === undefined) return;
    this.activeLevel = safeIndex;
    this.engine = this.createEngine(safeIndex);
    this.engine.start();
    this.previousPhase = 'playing';
    this.accumulator = 0;
    this.renderer?.resetCamera();
    this.hideRestartFeedback();
    this.hideModal();
    this.showBriefing(
      `<span>${definition.sector}</span><strong>${definition.name}</strong><em>${definition.briefing}</em>`,
    );
    this.announce(`${definition.name}. ${definition.briefing}`);
    void this.audio.activate().catch(() => undefined);
  }

  private showLevelBriefing(levelIndex: number): void {
    const markup = levelIntelTemplate(levelIndex);
    if (markup === null || this.modalContent === null) return;
    this.activeLevel = markup.levelIndex;
    this.engine = this.createEngine(markup.levelIndex);
    this.previousPhase = 'ready';
    this.accumulator = 0;
    this.renderer?.resetCamera();
    this.hideRestartFeedback();
    this.modalContent.innerHTML = markup.html;
    this.renderIntelPreviews();
    this.showModal();
  }

  private restart(): void {
    if (this.engine === null || this.engine.getSnapshot().phase === 'ready') return;
    this.hideRestartFeedback();
    this.beginLevel(this.activeLevel);
  }

  private togglePause(): void {
    if (this.engine === null) return;
    const phase = this.engine.getSnapshot().phase;
    if (phase === 'playing') {
      this.engine.pause();
      this.showPauseMenu();
      this.announce('Simulation paused.');
    } else if (phase === 'paused') {
      this.engine.start();
      this.hideModal();
      this.announce('Simulation resumed.');
    }
  }

  private handlePhaseChange(snapshot: GameSnapshot): void {
    if (snapshot.phase === this.previousPhase) return;
    this.previousPhase = snapshot.phase;
    if (snapshot.phase === 'lost') {
      window.setTimeout(() => this.showLostMenu(snapshot), 420);
      this.announce('Connection terminated. Retry the sector.');
    } else if (snapshot.phase === 'won') {
      saveBestScore(snapshot.levelIndex, snapshot.score);
      window.setTimeout(() => this.showWinMenu(snapshot), 500);
      this.announce(`Sector clear. Score ${snapshot.score}.`);
    }
  }

  private updateHud(snapshot: GameSnapshot): void {
    const hud = this.hud;
    const definition = LEVELS[snapshot.levelIndex];
    if (hud === null || definition === undefined) return;
    const wholeSeconds = Math.floor(snapshot.elapsedSeconds);
    const signature = [
      snapshot.levelIndex,
      snapshot.collected,
      snapshot.required,
      snapshot.disks,
      snapshot.score,
      wholeSeconds,
    ].join(':');
    if (signature === this.lastHudSignature) return;
    this.lastHudSignature = signature;
    hud.sector.textContent = definition.sector;
    hud.level.textContent = definition.name;
    hud.collected.textContent = snapshot.collected.toString().padStart(2, '0');
    hud.required.textContent = snapshot.required.toString().padStart(2, '0');
    hud.score.textContent = snapshot.score.toString().padStart(6, '0');
    hud.time.textContent = formatTime(wholeSeconds);
    hud.disks.textContent = snapshot.disks.toString();
    const progress = snapshot.required === 0 ? 1 : snapshot.collected / snapshot.required;
    hud.progress.style.setProperty('--progress', `${Math.round(progress * 100)}%`);
    hud.objective.textContent = progress >= 1 ? 'EXIT ONLINE' : 'EXTRACT INFOTRONS';
    hud.objective.dataset.complete = progress >= 1 ? 'true' : 'false';
  }

  private showMainMenu(): void {
    if (this.modalContent === null) return;
    this.engine = this.createEngine(this.activeLevel);
    this.previousPhase = 'ready';
    this.accumulator = 0;
    this.renderer?.resetCamera();
    this.hideRestartFeedback();
    this.modalContent.innerHTML = mainMenuTemplate();
    this.showModal();
  }

  private showPauseMenu(): void {
    if (this.modalContent === null) return;
    this.modalContent.innerHTML = pauseMenuTemplate(this.performanceVisible);
    this.showModal();
  }

  private showLostMenu(snapshot: GameSnapshot): void {
    if (this.modalContent === null) return;
    this.modalContent.innerHTML = lostMenuTemplate(snapshot);
    this.showModal();
  }

  private showWinMenu(snapshot: GameSnapshot): void {
    if (this.modalContent === null) return;
    this.modalContent.innerHTML = winMenuTemplate(snapshot);
    this.showModal();
  }

  private showBriefing(html: string): void {
    if (this.briefing === null) return;
    window.clearTimeout(this.briefingTimer);
    this.briefing.innerHTML = html;
    this.briefing.dataset.visible = 'true';
    this.briefingTimer = window.setTimeout(() => {
      if (this.briefing !== null) this.briefing.dataset.visible = 'false';
    }, 3400);
  }

  private hideBriefing(): void {
    window.clearTimeout(this.briefingTimer);
    this.briefingTimer = 0;
    if (this.briefing !== null) this.briefing.dataset.visible = 'false';
  }

  private renderIntelPreviews(): void {
    if (this.modalContent === null || this.renderer === null) return;
    for (const canvas of this.modalContent.querySelectorAll<HTMLCanvasElement>(
      'canvas[data-intel-preview]',
    )) {
      const kind = canvas.dataset.intelPreview as IntelPreviewKind | undefined;
      if (kind !== undefined) this.renderer.renderIntelPreview(canvas, kind);
    }
  }

  private updateRestartFeedback(progress: number | null): void {
    const feedback = this.restartFeedback;
    if (feedback === null) return;
    const canRestart = this.engine !== null && this.engine.getSnapshot().phase !== 'ready';
    if (progress === null || !canRestart) {
      if (feedback.dataset.mode === 'holding') this.hideRestartFeedback();
      return;
    }
    window.clearTimeout(this.restartHintTimer);
    this.restartHintTimer = 0;
    this.hideBriefing();
    feedback.dataset.mode = 'holding';
    feedback.style.setProperty('--restart-progress', `${progress * 100}`);
    if (this.restartMessage !== null) this.restartMessage.textContent = 'HOLD R TO RESTART';
  }

  private updateActionFeedback(progress: number | null, snapshot: GameSnapshot): void {
    const feedback = this.actionFeedback;
    if (feedback === null) return;
    if (progress === null || snapshot.phase !== 'playing' || snapshot.disks <= 0) {
      feedback.dataset.mode = 'hidden';
      feedback.style.setProperty('--action-progress', '0');
      return;
    }
    this.hideBriefing();
    feedback.dataset.mode = 'holding';
    feedback.style.setProperty('--action-progress', `${progress * 100}`);
  }

  private positionGameplayFeedback(): void {
    const anchor = this.renderer?.getPlayerScreenAnchor();
    if (anchor === null || anchor === undefined) return;
    const visibleFeedback = [this.actionFeedback, this.restartFeedback].filter(
      (element): element is HTMLElement =>
        element !== null && element.dataset.mode !== 'hidden',
    );
    const playerTop = anchor.y - anchor.tileSize * 0.42;
    visibleFeedback.forEach((element, index) => {
      element.style.left = `${anchor.x}px`;
      element.style.top = `${playerTop - 10 - index * 58}px`;
    });
  }

  private showRestartHint(): void {
    const feedback = this.restartFeedback;
    if (
      feedback === null ||
      this.engine === null ||
      this.engine.getSnapshot().phase === 'ready'
    ) {
      return;
    }
    window.clearTimeout(this.restartHintTimer);
    this.hideBriefing();
    feedback.dataset.mode = 'hint';
    feedback.style.setProperty('--restart-progress', '0');
    if (this.restartMessage !== null) this.restartMessage.textContent = 'HOLD R TO RESTART';
    this.announce('Hold R for two seconds to restart the sector.');
    this.restartHintTimer = window.setTimeout(() => this.hideRestartFeedback(), 1_800);
  }

  private hideRestartFeedback(): void {
    window.clearTimeout(this.restartHintTimer);
    this.restartHintTimer = 0;
    if (this.restartFeedback !== null) {
      this.restartFeedback.dataset.mode = 'hidden';
      this.restartFeedback.style.setProperty('--restart-progress', '0');
    }
  }

  private showModal(): void {
    if (this.modal === null) return;
    this.input?.clearGameplayState();
    this.modal.hidden = false;
    requestAnimationFrame(() => this.modal?.setAttribute('data-visible', 'true'));
    requestAnimationFrame(() => this.modal?.querySelector<HTMLElement>('button')?.focus());
  }

  private hideModal(): void {
    if (this.modal === null) return;
    this.modal.dataset.visible = 'false';
    window.setTimeout(() => {
      if (this.modal?.dataset.visible === 'false') this.modal.hidden = true;
    }, 240);
  }

  private readonly onMenuKeyDown = (event: KeyboardEvent): void => {
    const modal = this.modal;
    if (
      modal === null ||
      modal.hidden ||
      modal.dataset.visible !== 'true' ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    const controls = [
      ...modal.querySelectorAll<HTMLElement>('button:not(:disabled), input[type="checkbox"]:not(:disabled)'),
    ];
    if (controls.length === 0) return;
    const activeIndex = Math.max(0, controls.indexOf(document.activeElement as HTMLElement));
    if (event.code === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const tabIntent = event.shiftKey ? 'previous' : 'next';
      controls[menuNavigationIndex(activeIndex, controls.length, tabIntent)]?.focus();
      return;
    }
    const intent = menuNavigationIntent(event.code);
    if (intent === null) return;
    if (intent !== 'activate') {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = menuNavigationIndex(activeIndex, controls.length, intent);
      controls[nextIndex]?.focus();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) (controls[activeIndex] ?? controls[0])?.click();
  };

  private readonly onClick = (event: MouseEvent): void => {
    const control = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui]') : null;
    const action = control?.dataset.ui;
    if (action === undefined) return;
    if (action === 'performance' && control instanceof HTMLInputElement) {
      this.performanceVisible = control.checked;
      this.performance?.setVisible(this.performanceVisible);
      savePerformanceVisible(this.performanceVisible);
      this.announce(`Performance information ${this.performanceVisible ? 'shown' : 'hidden'}.`);
      return;
    }
    event.preventDefault();
    void this.audio.activate().catch(() => undefined);
    switch (action) {
      case 'launch':
        this.showLevelBriefing(this.activeLevel);
        break;
      case 'level': {
        const level = Number(control?.dataset.level ?? 0);
        this.activeLevel = Number.isFinite(level) ? level : 0;
        this.showLevelBriefing(this.activeLevel);
        break;
      }
      case 'deploy-level':
        this.beginLevel(this.activeLevel);
        break;
      case 'resume':
        this.togglePause();
        break;
      case 'restart':
        this.restart();
        break;
      case 'next':
        this.showLevelBriefing(this.activeLevel + 1);
        break;
      case 'menu':
        this.engine?.pause();
        this.showMainMenu();
        break;
      case 'sound':
        this.toggleSound();
        break;
      case 'zoom-in':
        this.renderer?.zoomIn();
        break;
      case 'zoom-out':
        this.renderer?.zoomOut();
        break;
    }
  };

  private toggleSound(): void {
    const enabled = !this.audio.isEnabled();
    this.audio.setEnabled(enabled);
    if (this.soundButton !== null) {
      this.soundButton.dataset.muted = enabled ? 'false' : 'true';
      this.soundButton.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
      this.soundButton.querySelector('span')?.replaceChildren(enabled ? 'SOUND ON' : 'MUTED');
    }
    saveAudioEnabled(enabled);
  }

  private loadAudioSetting(): void {
    if (isAudioMuted()) this.toggleSound();
  }

  private announce(message: string): void {
    if (this.liveRegion !== null) this.liveRegion.textContent = message;
  }

  private requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (element === null) throw new Error(`Required UI element not found: ${selector}`);
    return element;
  }

}

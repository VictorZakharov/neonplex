import { LEVELS } from '../game/levels';
import type { GameSnapshot } from '../game/types';
import { formatTime } from './formatTime';
import { LEVEL_INTEL } from './levelIntel';
import { getBestScore } from './localState';
import type { LevelIntelMarkup } from './uiTypes';

export const mainMenuTemplate = (): string => {
  const levelCards = LEVELS.map((level, index) => {
    const best = getBestScore(index);
    const dimensions = `${level.map[0]?.length ?? 0}×${level.map.length}`;
    return `
      <button class="sector-card" data-ui="level" data-level="${index}" type="button">
        <span class="sector-card__index">0${index + 1}</span>
        <span class="sector-card__copy">
          <strong>${level.name}</strong>
          <em>${level.sector.split('//')[1] ?? level.sector}</em>
        </span>
        <span class="sector-card__meta">${dimensions}<small>${best > 0 ? `BEST ${best}` : 'UNBREACHED'}</small></span>
      </button>`;
  }).join('');
  return `
    <section class="launch-panel" aria-labelledby="game-title">
      <div class="eyebrow"><i></i> SYNTHETIC MINING PROTOCOL <i></i></div>
      <h1 id="game-title"><span>NEON</span>PLEX</h1>
      <p class="launch-panel__tagline">Crack the grid. Extract the signal. Survive the cascade.</p>
      <div class="level-grid" aria-label="Select a sector">${levelCards}</div>
      <button class="primary-button" data-ui="launch" type="button">
        <span>INITIATE BREACH</span><kbd>ENTER</kbd>
      </button>
      <div class="control-strip">
        <span><kbd>WASD</kbd> MOVE</span><span><kbd>HOLD SPACE</kbd> DEPLOY HERE</span><span><kbd>SPACE + DIR</kbd> CONSUME</span>
        <span><kbd>WHEEL</kbd> OPTICAL ZOOM</span><span><kbd>L/R DRAG</kbd> PAN</span><span><kbd>ESC</kbd> PAUSE</span>
      </div>
    </section>`;
};

export const levelIntelTemplate = (requestedLevelIndex: number): LevelIntelMarkup | null => {
  const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, requestedLevelIndex));
  const definition = LEVELS[levelIndex];
  const intel = LEVEL_INTEL[levelIndex];
  if (definition === undefined || intel === undefined) return null;
  const width = definition.map[0]?.length ?? 0;
  const objectiveCount = definition.map.reduce(
    (count, row) => count + [...row].filter((symbol) => symbol === 'I').length,
    0,
  );
  const items = intel.items
    .map(
      (item) => `
        <article class="intel-item${item.danger === true ? ' intel-item--danger' : ''}">
          <div class="intel-icon intel-icon--canvas" aria-hidden="true">
            <canvas data-intel-preview="${item.icon}"></canvas>
          </div>
          <div><strong>${item.name}</strong><p>${item.description}</p></div>
        </article>`,
    )
    .join('');
  return {
    levelIndex,
    html: `
      <section class="intel-panel" aria-labelledby="intel-title">
        <div class="eyebrow">${definition.sector}</div>
        <div class="intel-panel__header">
          <div><span>PRE-BREACH INTELLIGENCE</span><h2 id="intel-title">${intel.heading}</h2></div>
          <dl><div><dt>GRID</dt><dd>${width}×${definition.map.length}</dd></div><div><dt>TARGETS</dt><dd>${objectiveCount}</dd></div></dl>
        </div>
        <p class="intel-panel__summary">${intel.summary}</p>
        <div class="intel-grid">${items}</div>
        <div class="intel-panel__footer">
          <span><i></i> Review complete — simulation remains paused</span>
          <button class="primary-button" data-ui="deploy-level" type="button">ENTER ${definition.name.toUpperCase()}</button>
        </div>
      </section>`,
  };
};

export const pauseMenuTemplate = (performanceVisible: boolean): string => `
  <section class="status-panel" aria-labelledby="pause-title">
    <div class="status-glyph status-glyph--pause"><span></span><span></span></div>
    <div class="eyebrow">SIMULATION SUSPENDED</div>
    <h2 id="pause-title">SYSTEM PAUSED</h2>
    <p>The grid is frozen. Re-enter when ready.</p>
    <label class="settings-toggle" for="performance-toggle">
      <input id="performance-toggle" data-ui="performance" type="checkbox" aria-controls="performance-meter" ${performanceVisible ? 'checked' : ''}>
      <span><strong>SHOW PERFORMANCE DEBUG</strong><em>FPS, 1% low, frame and draw timing</em></span>
    </label>
    <div class="button-row">
      <button class="primary-button" data-ui="resume" type="button">RESUME</button>
      <button class="ghost-button" data-ui="restart" type="button">RESTART SECTOR</button>
      <button class="ghost-button" data-ui="menu" type="button">ABORT TO MENU</button>
    </div>
  </section>`;

export const lostMenuTemplate = (snapshot: GameSnapshot): string => `
  <section class="status-panel status-panel--danger" aria-labelledby="lost-title">
    <div class="status-glyph status-glyph--danger">×</div>
    <div class="eyebrow">CARRIER SIGNAL LOST</div>
    <h2 id="lost-title">CONNECTION TERMINATED</h2>
    <p>The grid consumed this instance. Your route data remains intact.</p>
    <div class="result-stat"><span>SCORE</span><strong>${snapshot.score
      .toString()
      .padStart(6, '0')}</strong></div>
    <div class="button-row">
      <button class="primary-button" data-ui="restart" type="button">RECOMPILE &amp; RETRY</button>
      <button class="ghost-button" data-ui="menu" type="button">SECTOR SELECT</button>
    </div>
  </section>`;

export const winMenuTemplate = (snapshot: GameSnapshot): string => {
  const definition = LEVELS[snapshot.levelIndex];
  const par = definition?.parSeconds ?? 0;
  const rank =
    snapshot.elapsedSeconds <= par ? 'S' : snapshot.elapsedSeconds <= par * 1.35 ? 'A' : 'B';
  const hasNext = snapshot.levelIndex < LEVELS.length - 1;
  return `
    <section class="status-panel status-panel--success" aria-labelledby="win-title">
      <div class="rank-emblem"><span>RANK</span>${rank}</div>
      <div class="eyebrow">ALL INFOTRONS SECURED</div>
      <h2 id="win-title">SECTOR DECRYPTED</h2>
      <div class="results-grid">
        <div><span>SCORE</span><strong>${snapshot.score.toString().padStart(6, '0')}</strong></div>
        <div><span>RUNTIME</span><strong>${formatTime(snapshot.elapsedSeconds)}</strong></div>
        <div><span>EXTRACTED</span><strong>${snapshot.collected}/${snapshot.required}</strong></div>
      </div>
      <div class="button-row">
        <button class="primary-button" data-ui="${hasNext ? 'next' : 'menu'}" type="button">
          ${hasNext ? 'ENTER NEXT SECTOR' : 'RETURN TO NETWORK'}
        </button>
        <button class="ghost-button" data-ui="restart" type="button">RUN AGAIN</button>
      </div>
    </section>`;
};

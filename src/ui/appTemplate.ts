/** Static application shell. Dynamic menu content is supplied separately. */
export const appTemplate = (): string => `
  <div class="app-shell">
    <div class="ambient-orb ambient-orb--one"></div>
    <div class="ambient-orb ambient-orb--two"></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Neonplex home" data-ui="menu">
        <span class="brand__mark"><i></i><i></i><i></i></span>
        <span><strong>NEONPLEX</strong><em>DEEP GRID OPERATIONS</em></span>
      </a>
      <div class="mission-id">
        <span id="hud-sector">SECTOR 01 // AWAKENING</span>
        <strong id="hud-level">First Shift</strong>
      </div>
      <div class="topbar__actions">
        <button id="sound-toggle" class="icon-button sound-button" data-ui="sound" data-muted="false" type="button" aria-label="Mute sound">
          <i></i><span>SOUND ON</span>
        </button>
        <button class="icon-button pause-button" data-input="pause" type="button" aria-label="Pause game"><i></i><i></i></button>
      </div>
    </header>

    <main class="game-stage">
      <section class="hud-rail hud-rail--left" aria-label="Mission status">
        <div id="performance-meter" class="performance-meter" data-health="good" aria-label="Performance telemetry">
          <div><span>FPS</span><strong id="perf-fps">--</strong></div>
          <div><span>1% LOW</span><b id="perf-low">--</b></div>
          <div><span>FRAME</span><b id="perf-frame">-- ms</b></div>
          <div><span>DRAW</span><b id="perf-draw">-- ms</b></div>
        </div>
        <div class="hud-label">DATA EXTRACTION</div>
        <div class="extraction-count"><strong id="hud-collected">00</strong><span>/</span><em id="hud-required">00</em></div>
        <div id="hud-progress" class="progress-track"><i></i></div>
        <p id="hud-objective" data-complete="false">EXTRACT INFOTRONS</p>
      </section>

      <div class="canvas-shell">
        <canvas id="game-canvas" role="img" aria-label="Neonplex mining grid. Move with WASD, arrow keys, the touch joystick, or by dragging from the Carrier. Tap a clear straight route to travel and pinch or use the zoom controls to change magnification."></canvas>
        <div class="frame-corner frame-corner--tl"></div><div class="frame-corner frame-corner--tr"></div>
        <div class="frame-corner frame-corner--bl"></div><div class="frame-corner frame-corner--br"></div>
        <div id="briefing" class="briefing" data-visible="false"></div>
        <div id="restart-feedback" class="restart-feedback" data-mode="hidden" role="status" aria-live="polite">
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle class="restart-feedback__track" cx="22" cy="22" r="18"></circle>
            <circle class="restart-feedback__progress" cx="22" cy="22" r="18" pathLength="100"></circle>
          </svg>
          <span id="restart-message">HOLD R TO RESTART</span>
        </div>
        <div id="action-feedback" class="action-feedback" data-mode="hidden" role="status">
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle class="action-feedback__track" cx="22" cy="22" r="18"></circle>
            <circle class="action-feedback__progress" cx="22" cy="22" r="18" pathLength="100"></circle>
          </svg>
          <span>HOLD TO DEPLOY HERE</span>
        </div>
        <div id="modal" class="modal" data-visible="false"><div id="modal-content"></div></div>
        <div class="mobile-controls" role="group" aria-label="Touch controls">
          <div class="virtual-joystick" data-joystick role="group" tabindex="0" aria-label="Movement joystick. Drag in any direction to move the Carrier.">
            <span class="virtual-joystick__ring" aria-hidden="true">
              <i class="virtual-joystick__direction virtual-joystick__direction--up"></i>
              <i class="virtual-joystick__direction virtual-joystick__direction--right"></i>
              <i class="virtual-joystick__direction virtual-joystick__direction--down"></i>
              <i class="virtual-joystick__direction virtual-joystick__direction--left"></i>
              <b class="virtual-joystick__thumb"></b>
            </span>
          </div>
          <div class="touch-zoom-controls" aria-label="Map zoom controls">
            <button data-ui="zoom-out" type="button" aria-label="Zoom out">&minus;</button>
            <output id="touch-zoom-label" data-zoom-prefix="" aria-label="Current map zoom">100%</output>
            <button data-ui="zoom-in" type="button" aria-label="Zoom in">+</button>
          </div>
          <button class="pulse-control" data-input="action" type="button" aria-label="Hold for 1.5 seconds to deploy pulse disk beneath carrier"><i></i><span>PULSE</span></button>
        </div>
      </div>

      <section class="hud-rail hud-rail--right" aria-label="Telemetry">
        <div class="tactical-map">
          <div><span>TACTICAL MAP</span><em id="minimap-zoom" data-zoom-prefix="OPTICS">OPTICS 100%</em></div>
          <canvas id="minimap-canvas" role="img" aria-label="Tactical map showing the level, current viewport, and player position"></canvas>
        </div>
        <div class="telemetry"><span>RUNTIME</span><strong id="hud-time">00:00</strong></div>
        <div class="telemetry"><span>SCORE</span><strong id="hud-score">000000</strong></div>
        <div class="telemetry telemetry--disk"><span>PULSE DISKS</span><strong><i></i>×<b id="hud-disks">0</b></strong></div>
        <div class="signal"><span>LINK STABILITY</span><i><b></b><b></b><b></b><b></b><b></b></i><em>OPTIMAL</em></div>
      </section>
    </main>

    <footer class="footerbar">
      <div><span class="status-dot"></span> NETWORK LINK <strong>SECURE</strong></div>
      <div class="footer-controls"><span><kbd>WASD</kbd> MOVE</span><span><kbd>HOLD SPACE</kbd> DEPLOY HERE</span><span><kbd>SPACE+DIR</kbd> CONSUME</span><span><kbd>L/R DRAG</kbd> PAN</span><span><kbd>WHEEL</kbd> ZOOM</span><span><kbd>HOLD R</kbd> RESTART</span></div>
      <div>BUILD <strong>NPX-1.0.0</strong></div>
    </footer>
    <div id="live-region" class="sr-only" aria-live="polite"></div>
  </div>`;

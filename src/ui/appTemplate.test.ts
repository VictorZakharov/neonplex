import { appTemplate } from './appTemplate';

describe('appTemplate touch zoom affordances', () => {
  const markup = appTemplate();

  it('keeps the tactical zoom readout without rendering manual touch buttons', () => {
    expect(markup).toContain('id="minimap-zoom"');
    expect(markup).not.toContain('touch-zoom-controls');
    expect(markup).not.toContain('touch-zoom-label');
    expect(markup).not.toContain('data-ui="zoom-in"');
    expect(markup).not.toContain('data-ui="zoom-out"');
  });

  it('describes the remaining pinch and wheel zoom gestures', () => {
    expect(markup).toContain('pinch on a touch screen');
    expect(markup).toContain('use the mouse wheel to zoom');
  });
});

describe('appTemplate sound control', () => {
  const markup = appTemplate();

  it('uses a recognizable musical-note icon with a muted-state mark', () => {
    expect(markup).toContain('class="sound-button__icon"');
    expect(markup).toContain('class="sound-button__note-stem"');
    expect(markup).toContain('class="sound-button__note-head"');
    expect(markup).toContain('class="sound-button__mute-mark"');
  });

  it('keeps the decorative icon out of the accessibility tree', () => {
    expect(markup).toContain('aria-label="Sound" aria-pressed="true"');
    expect(markup).toContain('aria-hidden="true" focusable="false"');
  });
});

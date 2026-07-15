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

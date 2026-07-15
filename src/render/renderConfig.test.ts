import { MAIN_CANVAS_CONTEXT_OPTIONS } from './renderConfig';

describe('render configuration', () => {
  it('keeps the visible canvas compositor-synchronized', () => {
    expect(MAIN_CANVAS_CONTEXT_OPTIONS).toEqual({ alpha: false });
    expect(MAIN_CANVAS_CONTEXT_OPTIONS).not.toHaveProperty('desynchronized');
  });
});

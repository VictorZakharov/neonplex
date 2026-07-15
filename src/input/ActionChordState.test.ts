import { ActionChordState } from './ActionChordState';
import { ACTION_HOLD_DURATION_MS } from './restartHoldMath';

describe('ActionChordState', () => {
  it('does not deploy when Space is tapped', () => {
    const chord = new ActionChordState();

    expect(chord.pressAction(null, 1_000)).toBe(true);
    chord.releaseAction();

    expect(chord.consume(null)).toEqual({
      direction: null,
      action: false,
      excavate: null,
    });
  });

  it('deploys exactly once after an uninterrupted two-second hold', () => {
    const chord = new ActionChordState();
    const startedAt = 1_000;

    expect(chord.pressAction(null, startedAt)).toBe(true);
    expect(chord.getDeploymentHoldProgress(startedAt)).toBe(0);
    expect(
      chord.getDeploymentHoldProgress(startedAt + ACTION_HOLD_DURATION_MS / 2),
    ).toBe(0.5);
    expect(
      chord.getDeploymentHoldProgress(startedAt + ACTION_HOLD_DURATION_MS),
    ).toBe(1);

    chord.completeDeploymentHold();
    chord.completeDeploymentHold();

    expect(
      chord.getDeploymentHoldProgress(startedAt + ACTION_HOLD_DURATION_MS),
    ).toBeNull();
    expect(chord.consume(null)).toEqual({
      direction: null,
      action: true,
      excavate: null,
    });
    expect(chord.consume(null).action).toBe(false);
  });

  it('uses Space plus direction exclusively for stationary consumption', () => {
    const chord = new ActionChordState();
    chord.pressAction(null, 1_000);

    expect(chord.pressDirection('right')).toBe(true);
    expect(chord.getDeploymentHoldProgress(1_500)).toBeNull();
    expect(chord.consume('right')).toEqual({
      direction: null,
      action: false,
      excavate: 'right',
    });

    chord.releaseAction();
    expect(chord.consume('right')).toEqual({
      direction: 'right',
      action: false,
      excavate: null,
    });
  });

  it('restarts a full deployment delay after the final chord direction is released', () => {
    const chord = new ActionChordState();
    chord.pressAction(null, 1_000);
    chord.pressDirection('up');
    chord.consume('up');

    expect(chord.restartDeploymentHold(1_500)).toBe(true);
    expect(chord.getDeploymentHoldProgress(1_500)).toBe(0);
    expect(chord.getDeploymentHoldProgress(2_500)).toBe(0.5);

    chord.completeDeploymentHold();
    expect(chord.consume(null).action).toBe(true);
  });

  it('keeps an already-completed deployment committed when a direction arrives before consume', () => {
    const chord = new ActionChordState();
    chord.pressAction(null, 1_000);
    chord.completeDeploymentHold();
    chord.pressDirection('down');

    expect(chord.restartDeploymentHold(3_000)).toBe(false);
    expect(chord.consume(null).action).toBe(true);
    expect(chord.consume('down')).toEqual({
      direction: null,
      action: false,
      excavate: 'down',
    });
    expect(chord.getDeploymentHoldProgress(3_000)).toBeNull();
  });

  it('cannot restart deployment after Space is released', () => {
    const chord = new ActionChordState();
    chord.pressAction(null, 1_000);
    chord.pressDirection('left');
    chord.releaseAction();

    expect(chord.restartDeploymentHold(2_000)).toBe(false);
    expect(chord.getDeploymentHoldProgress(4_000)).toBeNull();
    expect(chord.consume(null).action).toBe(false);
  });

  it('retains a quick direction chord until the next simulation frame', () => {
    const chord = new ActionChordState();
    chord.pressAction(null, 1_000);
    chord.pressDirection('up');
    chord.releaseAction();

    expect(chord.consume(null)).toEqual({
      direction: null,
      action: false,
      excavate: 'up',
    });
  });
});

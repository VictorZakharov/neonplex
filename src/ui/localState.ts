const AUDIO_KEY = 'neonplex.audio';
const PERFORMANCE_KEY = 'neonplex.performance';

export const isAudioMuted = (): boolean => {
  try {
    return localStorage.getItem(AUDIO_KEY) === 'off';
  } catch {
    return false;
  }
};

export const saveAudioEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(AUDIO_KEY, enabled ? 'on' : 'off');
  } catch {
    // Privacy modes can disable local storage without affecting gameplay.
  }
};

export const isPerformanceVisible = (): boolean => {
  try {
    return localStorage.getItem(PERFORMANCE_KEY) !== 'off';
  } catch {
    return true;
  }
};

export const savePerformanceVisible = (visible: boolean): void => {
  try {
    localStorage.setItem(PERFORMANCE_KEY, visible ? 'on' : 'off');
  } catch {
    // Debug telemetry remains optional when storage is unavailable.
  }
};

export const getBestScore = (levelIndex: number): number => {
  try {
    return Number(localStorage.getItem(`neonplex.best.${levelIndex}`) ?? 0) || 0;
  } catch {
    return 0;
  }
};

export const saveBestScore = (levelIndex: number, score: number): void => {
  try {
    if (score > getBestScore(levelIndex)) {
      localStorage.setItem(`neonplex.best.${levelIndex}`, score.toString());
    }
  } catch {
    // Scores are an optional local enhancement.
  }
};

export const formatTime = (seconds: number): string => {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes.toString().padStart(2, '0')}:${(wholeSeconds % 60)
    .toString()
    .padStart(2, '0')}`;
};

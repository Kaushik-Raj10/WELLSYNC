export function calculateWellnessScore({
  sleep,
  water,
  steps,
  screenTime,
  mood,
  energy,
  stress,
}) {
  const sleepScore = Math.min(Number(sleep) / 8, 1) * 100;

  const hydrationScore = Math.min(Number(water) / 8, 1) * 100;

  const activityScore = Math.min(Number(steps) / 8000, 1) * 100;

  const screenScore =
    Number(screenTime) <= 4
      ? 100
      : Math.max(0, 100 - (Number(screenTime) - 4) * 15);

  const moodScores = {
    Great: 100,
    Good: 85,
    Okay: 65,
    Low: 40,
    Stressed: 25,
  };

  const moodScore = moodScores[mood] ?? 50;

  const energyScore = (Number(energy) / 10) * 100;

  const stressScore = ((10 - Number(stress)) / 9) * 100;

  const score =
    sleepScore * 0.2 +
    hydrationScore * 0.15 +
    activityScore * 0.2 +
    screenScore * 0.1 +
    moodScore * 0.15 +
    energyScore * 0.1 +
    stressScore * 0.1;

  return Math.round(score);
}
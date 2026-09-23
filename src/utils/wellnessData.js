const STORAGE_KEY = "wellsync_daily_data";
const HISTORY_KEY = "wellsync_history";
const GOALS_KEY = "wellsync_goals";

export const defaultWellnessData = {
  sleep: 7,
  water: 5,
  steps: 6000,
  screenTime: 5,
  mood: "Good",
  energy: 7,
  stress: 4,
};

export const defaultGoals = {
  sleep: 7,
  water: 6,
  steps: 6000,
  screenTime: 6,
};

export function saveWellnessData(data) {
  const normalizedData = {
    sleep: Number(data.sleep),
    water: Number(data.water),
    steps: Number(data.steps),
    screenTime: Number(data.screenTime),
    mood: data.mood,
    energy: Number(data.energy),
    stress: Number(data.stress),
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizedData)
  );

  // Store today's check-in in history
  const today = new Date().toISOString().split("T")[0];

  const history = getWellnessHistory();

  const existingIndex = history.findIndex(
    (entry) => entry.date === today
  );

  const historyEntry = {
    date: today,
    ...normalizedData,
  };

  if (existingIndex >= 0) {
    history[existingIndex] = historyEntry;
  } else {
    history.push(historyEntry);
  }

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history)
  );
}

export function getWellnessData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    return defaultWellnessData;
  }

  try {
    return {
      ...defaultWellnessData,
      ...JSON.parse(savedData),
    };
  } catch {
    return defaultWellnessData;
  }
}

export function getWellnessHistory() {
  const savedHistory = localStorage.getItem(HISTORY_KEY);

  if (!savedHistory) {
    return [];
  }

  try {
    return JSON.parse(savedHistory);
  } catch {
    return [];
  }
}

export function getGoals() {
  const savedGoals = localStorage.getItem(GOALS_KEY);

  if (!savedGoals) {
    return defaultGoals;
  }

  try {
    return {
      ...defaultGoals,
      ...JSON.parse(savedGoals),
    };
  } catch {
    return defaultGoals;
  }
}

export function saveGoals(goals) {
  localStorage.setItem(
    GOALS_KEY,
    JSON.stringify({
      sleep: Number(goals.sleep),
      water: Number(goals.water),
      steps: Number(goals.steps),
      screenTime: Number(goals.screenTime),
    })
  );
}
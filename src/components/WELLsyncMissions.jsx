import { useEffect, useMemo, useState } from "react";
import "./WELLsyncMissions.css";

const STORAGE_KEY = "wellsync_missions_v1";

function normalizeData(data) {
  if (!data) return null;

  return {
    sleep: Number(data.sleep ?? 0),
    water: Number(data.water ?? 0),
    steps: Number(data.steps ?? 0),
    screenTime: Number(
      data.screenTime ?? data.screen_time ?? 0
    ),
    mood: data.mood ?? "Okay",
    energy: Number(data.energy ?? 5),
    stress: Number(data.stress ?? 5),
  };
}

function normalizeGoals(goals) {
  return {
    sleep: Number(goals?.sleep ?? 7),
    water: Number(goals?.water ?? 6),
    steps: Number(goals?.steps ?? 6000),
    screenTime: Number(
      goals?.screenTime ?? goals?.screen_time ?? 6
    ),
  };
}

function normalizeHistory(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(Boolean)
    .map((row) => ({
      date: row.date ?? null,
      sleep: Number(row.sleep ?? 0),
      water: Number(row.water ?? 0),
      steps: Number(row.steps ?? 0),
      screenTime: Number(
        row.screenTime ?? row.screen_time ?? 0
      ),
      mood: row.mood ?? "Okay",
      energy: Number(row.energy ?? 5),
      stress: Number(row.stress ?? 5),
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function formatDate(date) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return String(date);
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readMissionStore() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeMissionStore(store) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(store)
    );
  } catch {}
}

function average(rows, key) {
  const values = rows
    .map((row) => Number(row?.[key]))
    .filter(Number.isFinite);

  if (!values.length) return 0;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function recentAverage(history, key) {
  return average(history.slice(-7), key);
}

function repeatedGap(history, key, compare) {
  const rows = history.slice(-7);

  if (rows.length < 3) return 0;

  return rows.filter((row) => compare(row[key])).length;
}

function chooseMission(data, goals, history) {
  const recent = history.slice(-7);

  if (!data) {
    return {
      id: "first-checkin",
      metric: "checkin",
      icon: "✦",
      eyebrow: "START MISSION",
      title: "Build your first wellness baseline",
      headline: "Today's Mission",
      currentLabel: "No check-in yet",
      targetLabel: "Complete today's check-in",
      summary:
        "Give WELLsync today's signals so future missions can become personal.",
      tasks: [
        "Complete your daily wellness check-in",
        "Review your current goals",
        "Return to the dashboard to unlock your first mission",
      ],
    };
  }

  const repeatedSleepGap = repeatedGap(
    recent,
    "sleep",
    (value) => Number(value) < goals.sleep
  );

  const repeatedStepGap = repeatedGap(
    recent,
    "steps",
    (value) => Number(value) < goals.steps
  );

  const repeatedWaterGap = repeatedGap(
    recent,
    "water",
    (value) => Number(value) < goals.water
  );

  const repeatedScreenGap = repeatedGap(
    recent,
    "screenTime",
    (value) => Number(value) > goals.screenTime
  );

  const candidates = [
    {
      score:
        (data.sleep < goals.sleep ? 5 : 0) +
        Math.min(repeatedSleepGap, 4),
      mission: {
        id: "sleep-reset",
        metric: "sleep",
        icon: "◒",
        eyebrow: "TONIGHT'S MISSION",
        title: "Protect a 30-minute earlier wind-down",
        headline: "Tonight's Mission",
        currentLabel: `${recentAverage(recent, "sleep").toFixed(2)}h recent average`,
        targetLabel: `${goals.sleep.toFixed(1)}h target`,
        summary:
          "Use a small, repeatable wind-down to create more room for your sleep target.",
        tasks: [
          "Stop high-intensity screen use during your final 30 minutes",
          "Start a calm wind-down before you feel rushed for bed",
          "Aim to give yourself 30 more minutes for sleep than on a typical short-sleep night",
        ],
      },
    },
    {
      score:
        (data.steps < goals.steps ? 5 : 0) +
        Math.min(repeatedStepGap, 4),
      mission: {
        id: "movement-reset",
        metric: "steps",
        icon: "↗",
        eyebrow: "TODAY'S MISSION",
        title: "Close part of your movement gap",
        headline: "Today's Mission",
        currentLabel: `${Math.round(recentAverage(recent, "steps")).toLocaleString("en-IN")} recent average steps`,
        targetLabel: `${Math.round(goals.steps).toLocaleString("en-IN")} step target`,
        summary:
          "Turn the remaining movement gap into short, manageable activity blocks.",
        tasks: [
          "Take a comfortable 10–20 minute walk",
          "Add one short mobility or movement break",
          "Take another brief walk or activity break later if it feels comfortable",
        ],
      },
    },
    {
      score:
        (data.water < goals.water ? 4 : 0) +
        Math.min(repeatedWaterGap, 3),
      mission: {
        id: "hydration-reset",
        metric: "water",
        icon: "◇",
        eyebrow: "TODAY'S MISSION",
        title: "Bring hydration closer to your target",
        headline: "Today's Mission",
        currentLabel: `${recentAverage(recent, "water").toFixed(1)}-glass recent average`,
        targetLabel: `${goals.water.toFixed(1)}-glass target`,
        summary:
          "Make hydration easier by spreading small water breaks through the day.",
        tasks: [
          "Have one glass of water during your next routine break",
          "Keep water visible and easy to reach",
          "Add one more planned water break later today",
        ],
      },
    },
    {
      score:
        (data.screenTime > goals.screenTime ? 4 : 0) +
        Math.min(repeatedScreenGap, 3),
      mission: {
        id: "digital-reset",
        metric: "screenTime",
        icon: "□",
        eyebrow: "TODAY'S MISSION",
        title: "Create one deliberate screen-free block",
        headline: "Today's Mission",
        currentLabel: `${recentAverage(recent, "screenTime").toFixed(1)}h recent average`,
        targetLabel: `≤ ${goals.screenTime.toFixed(1)}h target`,
        summary:
          "Create a realistic pause from screens instead of trying to eliminate them.",
        tasks: [
          "Choose one 20–30 minute screen-free block",
          "Use the break for a walk, stretch, conversation or quiet activity",
          "Keep the final part of your evening calmer and less screen-heavy",
        ],
      },
    },
    {
      score:
        (data.stress >= 7 ? 4 : 0) +
        (data.energy <= 4 ? 2 : 0),
      mission: {
        id: "recovery-reset",
        metric: "stress",
        icon: "≈",
        eyebrow: "TODAY'S MISSION",
        title: "Build a small recovery window",
        headline: "Today's Mission",
        currentLabel: `Stress ${data.stress}/10`,
        targetLabel: "Protect your available energy",
        summary:
          "Use a low-pressure reset rather than adding a demanding task to the day.",
        tasks: [
          "Take a 5–10 minute quiet break",
          "Try gentle movement or a short walk if it feels comfortable",
          "Return to one manageable priority instead of stacking more tasks",
        ],
      },
    },
  ];

  const best = [...candidates]
    .sort((a, b) => b.score - a.score)[0];

  return (
    best?.mission || {
      id: "steady-rhythm",
      metric: "balanced",
      icon: "✦",
      eyebrow: "TODAY'S MISSION",
      title: "Protect the rhythm you've built",
      headline: "Today's Mission",
      currentLabel: "Signals relatively balanced",
      targetLabel: "Keep it sustainable",
      summary:
        "Use today to reinforce a few habits that already fit your routine.",
      tasks: [
        "Take a short movement break",
        "Keep hydration visible throughout the day",
        "Protect your normal sleep and recovery routine",
      ],
    }
  );
}

function getOutcomeValue(row, metric) {
  if (!row) return null;

  if (metric === "sleep") return Number(row.sleep);
  if (metric === "steps") return Number(row.steps);
  if (metric === "water") return Number(row.water);
  if (metric === "screenTime") return Number(row.screenTime);
  if (metric === "stress") return Number(row.stress);

  return null;
}

function formatOutcome(metric, before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return null;
  }

  const delta = after - before;

  if (metric === "sleep") {
    return {
      value: `${before.toFixed(2)}h → ${after.toFixed(2)}h`,
      detail: `${Math.abs(delta).toFixed(2)}h ${
        delta >= 0 ? "increase" : "decrease"
      } in the recorded value.`,
    };
  }

  if (metric === "steps") {
    return {
      value: `${Math.round(before).toLocaleString("en-IN")} → ${Math.round(
        after
      ).toLocaleString("en-IN")}`,
      detail: `${Math.abs(Math.round(delta)).toLocaleString(
        "en-IN"
      )} steps ${delta >= 0 ? "increase" : "decrease"} in the recorded value.`,
    };
  }

  if (metric === "water") {
    return {
      value: `${before.toFixed(1)} → ${after.toFixed(1)} glasses`,
      detail: `${Math.abs(delta).toFixed(1)} glass ${
        delta >= 0 ? "increase" : "decrease"
      } in the recorded value.`,
    };
  }

  if (metric === "screenTime") {
    return {
      value: `${before.toFixed(1)}h → ${after.toFixed(1)}h`,
      detail: `${Math.abs(delta).toFixed(1)}h ${
        delta <= 0 ? "reduction" : "increase"
      } in the recorded value.`,
    };
  }

  if (metric === "stress") {
    return {
      value: `${before}/10 → ${after}/10`,
      detail: `${Math.abs(delta).toFixed(1)} ${
        delta <= 0 ? "lower" : "higher"
      } recorded stress signal.`,
    };
  }

  return null;
}

function findOutcome(history, missionDate, metric) {
  if (!missionDate || metric === "checkin" || metric === "balanced") {
    return null;
  }

  const rows = normalizeHistory(history);

  const currentIndex = rows.findIndex(
    (row) => row.date === missionDate
  );

  const laterRows =
    currentIndex >= 0
      ? rows.slice(currentIndex + 1)
      : rows.filter((row) => String(row.date) > String(missionDate));

  const nextRow = laterRows[0];

  if (!nextRow) return null;

  const baselineRow =
    currentIndex >= 0
      ? rows[currentIndex]
      : rows.find((row) => row.date === missionDate);

  const before = getOutcomeValue(
    baselineRow,
    metric
  );

  const after = getOutcomeValue(
    nextRow,
    metric
  );

  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return null;
  }

  return {
    nextDate: nextRow.date,
    formatted: formatOutcome(metric, before, after),
  };
}

export default function WELLsyncMissions({
  data,
  goals,
  history,
  age,
  onNavigate,
}) {
  const normalizedData = useMemo(
    () => normalizeData(data),
    [data]
  );

  const normalizedGoals = useMemo(
    () => normalizeGoals(goals),
    [goals]
  );

  const normalizedHistory = useMemo(
    () => normalizeHistory(history),
    [history]
  );

  const date = todayKey();

  const missionTemplate = useMemo(
    () =>
      chooseMission(
        normalizedData,
        normalizedGoals,
        normalizedHistory
      ),
    [normalizedData, normalizedGoals, normalizedHistory]
  );

  const [checked, setChecked] = useState([]);
  const [missionStarted, setMissionStarted] = useState(false);

  useEffect(() => {
    const store = readMissionStore();
    const saved = store[date];

    if (
      saved &&
      saved.missionId === missionTemplate.id
    ) {
      setChecked(
        Array.isArray(saved.checked)
          ? saved.checked
          : []
      );
      setMissionStarted(Boolean(saved.started));
    } else {
      setChecked([]);
      setMissionStarted(false);
    }
  }, [date, missionTemplate.id]);

  useEffect(() => {
    const store = readMissionStore();

    store[date] = {
      missionId: missionTemplate.id,
      metric: missionTemplate.metric,
      started: missionStarted,
      checked,
      completed:
        missionTemplate.tasks.length > 0 &&
        checked.length === missionTemplate.tasks.length,
      completedAt:
        checked.length === missionTemplate.tasks.length &&
        missionTemplate.tasks.length > 0
          ? new Date().toISOString()
          : null,
    };

    writeMissionStore(store);
  }, [
    date,
    missionTemplate.id,
    missionTemplate.metric,
    missionTemplate.tasks.length,
    missionStarted,
    checked,
  ]);

  const completed =
    missionTemplate.tasks.length > 0 &&
    checked.length === missionTemplate.tasks.length;

  const outcome = findOutcome(
    normalizedHistory,
    date,
    missionTemplate.metric
  );

  function toggleTask(index) {
    setMissionStarted(true);

    setChecked((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  }

  function resetMission() {
    setChecked([]);
    setMissionStarted(false);
  }

  function openMissionWithAI() {
    try {
      sessionStorage.setItem(
        "wellsync_ai_prompt",
        `Help me complete my WELLsync mission: "${missionTemplate.title}". Break it into simple, age-appropriate steps using my current wellness context. Keep it sustainable and do not overinterpret my data.`
      );

      sessionStorage.setItem(
        "wellsync_ai_mode",
        missionTemplate.metric === "sleep" ||
          missionTemplate.metric === "stress"
          ? "recovery"
          : "trainer"
      );
    } catch {}

    onNavigate?.("ai");
  }

  const ageNote =
    Number.isInteger(Number(age)) &&
    Number(age) < 18
      ? "Age-aware plan · sustainable everyday wellness focus"
      : "Sustainable everyday wellness focus";

  return (
    <section className="wellsync-missions-card glass-panel">
      <div className="wellsync-missions-header">
        <div>
          <div className="wellsync-missions-eyebrow">
            <span>✦</span> WELLSYNC MISSIONS
          </div>
          <h2>
            {completed
              ? "Mission completed."
              : missionTemplate.title}
          </h2>
          <p>{missionTemplate.summary}</p>
        </div>

        <div className="wellsync-mission-status">
          {completed ? "✓ COMPLETED" : "ACTIVE TODAY"}
        </div>
      </div>

      <div className="wellsync-mission-grid">
        <div className="wellsync-mission-main">
          <div className="wellsync-mission-label">
            {missionTemplate.eyebrow}
          </div>

          <h3>{missionTemplate.headline}</h3>

          <div className="wellsync-mission-context">
            <div>
              <span>CURRENT</span>
              <strong>{missionTemplate.currentLabel}</strong>
            </div>
            <div>
              <span>TARGET</span>
              <strong>{missionTemplate.targetLabel}</strong>
            </div>
          </div>

          <div className="wellsync-mission-tasks">
            {missionTemplate.tasks.map(
              (task, index) => {
                const isChecked =
                  checked.includes(index);

                return (
                  <button
                    type="button"
                    key={task}
                    className={`wellsync-mission-task ${
                      isChecked ? "checked" : ""
                    }`}
                    onClick={() =>
                      toggleTask(index)
                    }
                  >
                    <span className="wellsync-task-box">
                      {isChecked ? "✓" : ""}
                    </span>
                    <span>{task}</span>
                  </button>
                );
              }
            )}
          </div>

          <div className="wellsync-mission-actions">
            <button
              type="button"
              className="wellsync-mission-primary"
              onClick={openMissionWithAI}
            >
              Plan this with WELLsync AI <span>↗</span>
            </button>

            {missionStarted && !completed && (
              <button
                type="button"
                className="wellsync-mission-secondary"
                onClick={resetMission}
              >
                Reset mission
              </button>
            )}
          </div>
        </div>

        <aside className="wellsync-mission-outcome">
          <div className="wellsync-outcome-label">
            <span>OUTCOME LOOP</span>
            <strong>
              {completed ? "✓ MISSION COMPLETE" : "→ NEXT CHECK-IN"}
            </strong>
          </div>

          {outcome?.formatted ? (
            <>
              <div className="wellsync-outcome-success">
                <span>
                  Recorded outcome · {formatDate(outcome.nextDate)}
                </span>
                <strong>{outcome.formatted.value}</strong>
                <p>{outcome.formatted.detail}</p>
              </div>

              <div className="wellsync-outcome-learning">
                <span>WHAT WELLsync LEARNED</span>
                <p>
                  This is an observed change in the recorded data after the
                  mission day. It does not establish that the mission caused
                  the change.
                </p>
              </div>
            </>
          ) : (
            <div className="wellsync-outcome-waiting">
              <div className="wellsync-outcome-orbit">
                {completed ? "✓" : "→"}
              </div>
              <strong>
                {completed
                  ? "Check in again tomorrow."
                  : "Finish the mission, then check in again."}
              </strong>
              <p>
                WELLsync will compare the next recorded day with this mission
                day's value and show the observed outcome here.
              </p>
            </div>
          )}
        </aside>
      </div>

      <div className="wellsync-missions-footer">
        <span>{ageNote}</span>
        <span>
          Data → Insight → Recommendation → Action → Outcome → Learning
        </span>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  getCloudCheckins,
  getCloudGoals,
} from "../utils/supabaseData";
import {
  defaultGoals,
  getGoals,
  getWellnessData,
  getWellnessHistory,
  saveGoals,
} from "../utils/wellnessData";
import { saveCloudGoals } from "../utils/supabaseData";
import { calculateWellnessScore } from "../utils/wellnessScore";
import "./Goals.css";

const DEFAULT_GOALS = {
  sleep: Number(defaultGoals?.sleep ?? 7),
  water: Number(defaultGoals?.water ?? 6),
  steps: Number(defaultGoals?.steps ?? 6000),
  screenTime: Number(defaultGoals?.screenTime ?? 6),
};

function normalizeGoals(data) {
  return {
    sleep: Number(data?.sleep ?? DEFAULT_GOALS.sleep),
    water: Number(data?.water ?? DEFAULT_GOALS.water),
    steps: Number(data?.steps ?? DEFAULT_GOALS.steps),
    screenTime: Number(data?.screenTime ?? data?.screen_time ?? DEFAULT_GOALS.screenTime),
  };
}

function normalizeWellness(data) {
  if (!data) return null;

  return {
    sleep: Number(data.sleep ?? 0),
    water: Number(data.water ?? 0),
    steps: Number(data.steps ?? 0),
    screenTime: Number(data.screenTime ?? data.screen_time ?? 0),
    mood: data.mood ?? "Okay",
    energy: Number(data.energy ?? 5),
    stress: Number(data.stress ?? 5),
  };
}

function normalizeHistory(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(Boolean)
    .map((item) => ({
      date: item.date ?? null,
      sleep: Number(item.sleep ?? 0),
      water: Number(item.water ?? 0),
      steps: Number(item.steps ?? 0),
      screenTime: Number(item.screenTime ?? item.screen_time ?? 0),
      mood: item.mood ?? "Okay",
      energy: Number(item.energy ?? 5),
      stress: Number(item.stress ?? 5),
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function getGoalMeta(key) {
  const meta = {
    sleep: {
      label: "Sleep",
      icon: "◐",
      unit: "hours",
      description: "A steady sleep target for your routine.",
      colorClass: "purple",
    },
    water: {
      label: "Hydration",
      icon: "◇",
      unit: "glasses",
      description: "A simple daily hydration target.",
      colorClass: "cyan",
    },
    steps: {
      label: "Movement",
      icon: "↗",
      unit: "steps",
      description: "A practical daily movement target.",
      colorClass: "green",
    },
    screenTime: {
      label: "Screen balance",
      icon: "□",
      unit: "hours max",
      description: "Your preferred daily screen-time ceiling.",
      colorClass: "amber",
    },
  };

  return meta[key];
}

function getProgress(key, current, goal) {
  if (!current || !goal) return 0;

  if (key === "screenTime") {
    return clamp((goal / Math.max(current, 0.01)) * 100);
  }

  return clamp((current / goal) * 100);
}

function getProgressLabel(key, current, goal) {
  if (key === "screenTime") {
    if (current <= goal) return "On target";
    return `${Math.round(current - goal)}h over target`;
  }

  if (current >= goal) return "On target";
  const gap = goal - current;

  if (key === "steps") return `${Math.round(gap).toLocaleString()} to go`;
  if (key === "water") return `${Math.round(gap * 10) / 10} to go`;
  return `${Math.round(gap * 10) / 10}h to go`;
}

function getAdaptiveSignal(current, average, goal, key) {
  if (!current || !average) {
    return {
      title: "Build your baseline",
      text: "Keep checking in so WELLsync can understand your usual range before suggesting adjustments.",
    };
  }

  if (key === "screenTime") {
    if (average <= goal) {
      return {
        title: "Target looks aligned",
        text: "Your recorded average is already at or below your current screen-time target.",
      };
    }

    return {
      title: "Consider a more workable target",
      text: `Your recorded average is ${average.toFixed(1)}h, above your ${goal}h target. Consistency may matter more than making the target dramatically lower.`,
    };
  }

  const ratio = average / goal;

  if (ratio >= 0.95 && ratio <= 1.15) {
    return {
      title: "Target looks realistic",
      text: "Your recent average is already close to this target, so maintaining consistency may be the useful next step.",
    };
  }

  if (ratio < 0.75) {
    return {
      title: "Large gap detected",
      text: "There is a noticeable gap between your recent average and the target. A smaller intermediate milestone may be easier to sustain.",
    };
  }

  return {
    title: "Room to refine",
    text: "Your recent average is moving toward the target. Keep the change practical and review it after more check-ins.",
  };
}

function saveToAI(prompt) {
  try {
    sessionStorage.setItem("wellsync_ai_prompt", prompt);
    sessionStorage.setItem("wellsync_ai_mode", "goals");
  } catch {
    // Best-effort handoff.
  }
}

function GoalCard({ goalKey, goal, current, onChange }) {
  const meta = getGoalMeta(goalKey);
  const progress = getProgress(goalKey, current, goal);
  const status = getProgressLabel(goalKey, current, goal);

  return (
    <article className={`goal-card ${meta.colorClass}`}>
      <div className="goal-card-top">
        <div className="goal-card-icon">{meta.icon}</div>
        <div>
          <span className="goal-card-label">{meta.label}</span>
          <p>{meta.description}</p>
        </div>
      </div>

      <div className="goal-card-value-row">
        <div className="goal-current">
          <small>Current</small>
          <strong>
            {current ?? "—"}
            {goalKey === "steps" ? "" : goalKey === "water" ? "" : "h"}
            {goalKey === "water" && current != null ? " glasses" : ""}
          </strong>
        </div>

        <div className="goal-arrow">→</div>

        <label className="goal-target">
          <small>Target</small>
          <div className="goal-target-input">
            <input
              type="number"
              value={goal}
              min={goalKey === "steps" ? 1000 : 0}
              max={goalKey === "steps" ? 50000 : goalKey === "screenTime" ? 24 : 24}
              step={goalKey === "steps" ? 500 : 0.5}
              onChange={(event) => onChange(goalKey, event.target.value)}
              aria-label={`${meta.label} goal`}
            />
            <span>
              {goalKey === "steps"
                ? "steps"
                : goalKey === "water"
                  ? "glasses"
                  : "h"}
            </span>
          </div>
        </label>
      </div>

      <div className="goal-progress">
        <div className="goal-progress-track">
          <div className="goal-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="goal-progress-meta">
          <span>{status}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </article>
  );
}

export default function Goals({ onNavigate }) {
  const [goals, setGoals] = useState(() => normalizeGoals(getGoals()));
  const [current, setCurrent] = useState(() => normalizeWellness(getWellnessData()));
  const [history, setHistory] = useState(() => normalizeHistory(getWellnessHistory()));
  const [source, setSource] = useState("local");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      setLoadError("");

      const localCurrent = normalizeWellness(getWellnessData());
      const localHistory = normalizeHistory(getWellnessHistory());

      if (mounted) {
        setCurrent(localCurrent);
        setHistory(localHistory);
      }

      try {
        const [cloudGoals, cloudHistory] = await Promise.all([
          getCloudGoals(),
          getCloudCheckins(),
        ]);

        if (!mounted) return;

        if (cloudGoals) {
          setGoals(normalizeGoals(cloudGoals));
          setSource("cloud");
        }

        const normalizedCloudHistory = normalizeHistory(cloudHistory);

        if (normalizedCloudHistory.length) {
          setHistory(normalizedCloudHistory);
          setCurrent(normalizedCloudHistory[normalizedCloudHistory.length - 1]);
          setSource("cloud");
        }
      } catch (error) {
        console.info("Goals using local context:", error?.message || error);
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSaved(false);
  }, [goals]);

  const latest = current;

  const score = useMemo(() => {
    return latest ? Math.round(calculateWellnessScore(latest)) : 0;
  }, [latest]);

  const averages = useMemo(() => {
    const rows = history.slice(-7);

    if (!rows.length) return null;

    const totals = rows.reduce(
      (acc, item) => ({
        sleep: acc.sleep + item.sleep,
        water: acc.water + item.water,
        steps: acc.steps + item.steps,
        screenTime: acc.screenTime + item.screenTime,
      }),
      { sleep: 0, water: 0, steps: 0, screenTime: 0 }
    );

    return {
      sleep: totals.sleep / rows.length,
      water: totals.water / rows.length,
      steps: totals.steps / rows.length,
      screenTime: totals.screenTime / rows.length,
    };
  }, [history]);

  const adaptiveCards = useMemo(
    () =>
      ["sleep", "water", "steps", "screenTime"].map((key) => ({
        key,
        ...getAdaptiveSignal(
          latest?.[key],
          averages?.[key],
          goals[key],
          key
        ),
      })),
    [latest, averages, goals]
  );

  const focusGoal = useMemo(() => {
    if (!latest) return "consistency";

    const candidates = [
      {
        key: "sleep",
        gap: Math.max(goals.sleep - latest.sleep, 0) / Math.max(goals.sleep, 1),
      },
      {
        key: "water",
        gap: Math.max(goals.water - latest.water, 0) / Math.max(goals.water, 1),
      },
      {
        key: "steps",
        gap: Math.max(goals.steps - latest.steps, 0) / Math.max(goals.steps, 1),
      },
      {
        key: "screenTime",
        gap: Math.max(latest.screenTime - goals.screenTime, 0) /
          Math.max(goals.screenTime, 1),
      },
    ];

    return candidates.sort((a, b) => b.gap - a.gap)[0]?.key || "consistency";
  }, [latest, goals]);

  const focusMeta = focusGoal === "consistency"
    ? { label: "Consistency", icon: "✦" }
    : {
        label: getGoalMeta(focusGoal).label,
        icon: getGoalMeta(focusGoal).icon,
      };

  function handleChange(key, value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return;

    setGoals((previous) => ({
      ...previous,
      [key]: parsed,
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    const normalized = normalizeGoals(goals);

    try {
      saveGoals(normalized);

      try {
        await saveCloudGoals(normalized);
        setSource("cloud");
      } catch (cloudError) {
        console.info("Cloud goal save unavailable:", cloudError?.message || cloudError);
      }

      setGoals(normalized);
      setSaved(true);
    } catch (error) {
      console.error("Could not save goals:", error);
      setLoadError("Your goals could not be saved. Your existing goals were left unchanged.");
    } finally {
      setSaving(false);
    }
  }

  function openAI(prompt) {
    saveToAI(prompt);
    onNavigate?.("ai");
  }

  const buildPlanPrompt = `Act as my WELLsync Goal Coach. Review my current goals, current wellness snapshot, recent history, and goal gaps. Build a practical 7-day action plan that prioritizes sustainable progress. Explain which goal you would focus on first and why, suggest realistic daily actions, and define a simple way to review progress at the end of the week. Do not diagnose or prescribe treatment. Current goals: ${JSON.stringify(
    goals
  )}. Current wellness: ${JSON.stringify(
    latest
  )}. Recent history: ${JSON.stringify(history.slice(-7))}.`;

  return (
    <div className="goals-page">
      <header className="goals-hero">
        <div className="goals-hero-copy">
          <span className="goals-kicker">PERSONAL GOAL INTELLIGENCE</span>
          <h1>Make your goals <em>work for you.</em></h1>
          <p>
            Set targets, see the gap to today, and let WELLsync use your recent
            routine to make the next step more practical.
          </p>
        </div>

        <div className="goals-hero-meta">
          <div className="goals-source-pill">
            <span />
            {source === "cloud" ? "Synced with Supabase" : "Saved locally"}
          </div>

          <div className="goals-score-pill">
            <strong>{score}</strong>
            <span>current signal</span>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="goals-error" role="alert">
          {loadError}
        </div>
      )}

      <section className="goals-ai-banner">
        <div className="goals-ai-orbit">✦</div>
        <div className="goals-ai-copy">
          <span>AI GOAL COACH</span>
          <h2>Turn your targets into an adaptive weekly plan.</h2>
          <p>
            WELLsync can combine your goals, current signals, and recent history
            before building your next actions.
          </p>
        </div>

        <button
          type="button"
          className="goals-primary-button"
          onClick={() => openAI(buildPlanPrompt)}
        >
          Build my AI plan <span>↗</span>
        </button>
      </section>

      <section className="goals-section-head">
        <div>
          <span className="goals-kicker">YOUR TARGETS</span>
          <h2>Set the numbers that matter to your routine.</h2>
        </div>

        <div className="goals-save-wrap">
          {saved && <span className="goals-saved-note">✓ Goals saved</span>}
          <button
            type="button"
            className="goals-save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save goals"}
          </button>
        </div>
      </section>

      <section className="goals-grid">
        <GoalCard
          goalKey="sleep"
          goal={goals.sleep}
          current={latest?.sleep}
          onChange={handleChange}
        />
        <GoalCard
          goalKey="water"
          goal={goals.water}
          current={latest?.water}
          onChange={handleChange}
        />
        <GoalCard
          goalKey="steps"
          goal={goals.steps}
          current={latest?.steps}
          onChange={handleChange}
        />
        <GoalCard
          goalKey="screenTime"
          goal={goals.screenTime}
          current={latest?.screenTime}
          onChange={handleChange}
        />
      </section>

      <section className="goals-focus-grid">
        <article className="goals-focus-card">
          <div className="goals-card-eyebrow">CURRENT GAP</div>
          <div className="goals-focus-icon">{focusMeta.icon}</div>
          <h3>{focusMeta.label}</h3>
          <p>
            WELLsync is using the largest current goal gap as a navigation cue.
            It is a planning signal, not a medical judgement.
          </p>
          <button
            type="button"
            className="goals-secondary-button"
            onClick={() =>
              openAI(
                `Analyze my ${focusMeta.label.toLowerCase()} goal using my current wellness data and recent history. Explain the gap, what may be making it harder to close, and give me three practical actions for the next 24 hours.`
              )
            }
          >
            Ask AI about this goal <span>↗</span>
          </button>
        </article>

        <article className="goals-adaptive-card">
          <div className="goals-card-eyebrow">ADAPTIVE SIGNALS</div>
          <h3>What your recent average suggests</h3>

          <div className="adaptive-list">
            {adaptiveCards.map((item) => (
              <div className="adaptive-row" key={item.key}>
                <div className={`adaptive-icon ${getGoalMeta(item.key).colorClass}`}>
                  {getGoalMeta(item.key).icon}
                </div>
                <div className="adaptive-copy">
                  <strong>{getGoalMeta(item.key).label}</strong>
                  <span>{item.title}</span>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="goals-review-card">
        <div>
          <div className="goals-card-eyebrow">WEEKLY REVIEW</div>
          <h3>Don't just hit a target. Learn from the pattern.</h3>
          <p>
            After a few more check-ins, use AI to compare your goals with your
            actual routine and decide whether the target still fits your day.
          </p>
        </div>

        <div className="goals-review-stats">
          <div>
            <strong>{history.length}</strong>
            <span>tracked days</span>
          </div>
          <div>
            <strong>{averages ? averages.sleep.toFixed(1) : "—"}</strong>
            <span>avg sleep</span>
          </div>
          <div>
            <strong>{averages ? Math.round(averages.steps).toLocaleString() : "—"}</strong>
            <span>avg steps</span>
          </div>
        </div>

        <button
          type="button"
          className="goals-secondary-button"
          onClick={() =>
            openAI(
              `Perform a weekly goal review from my recent WELLsync history. Compare my tracked goals with my actual averages, highlight patterns, and give me a realistic review checklist for the next week.`
            )
          }
        >
          Review my week with AI <span>↗</span>
        </button>
      </section>
    </div>
  );
}

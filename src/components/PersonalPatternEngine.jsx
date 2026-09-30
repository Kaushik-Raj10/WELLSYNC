import { useMemo } from "react";
import "./PersonalPatternEngine.css";

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

function moodScore(mood) {
  return (
    {
      Great: 9,
      Good: 8,
      Okay: 6,
      Low: 4,
      Stressed: 2,
    }[mood] ?? 5
  );
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

function ratioLabel(count, total) {
  if (!total) return "Not enough observations";

  return `${count} of ${total}`;
}

function buildSleepEnergyPattern(rows) {
  const observations = rows.slice(-7);

  const pairs = [];

  for (let index = 0; index < observations.length - 1; index += 1) {
    const sleep = observations[index];
    const next = observations[index + 1];

    if (!sleep.date || !next.date) continue;

    if (
      Number.isFinite(sleep.sleep) &&
      Number.isFinite(next.energy)
    ) {
      pairs.push({
        sleepHours: sleep.sleep,
        nextEnergy: next.energy,
        sourceDate: sleep.date,
        followDate: next.date,
      });
    }
  }

  const shortSleep = pairs.filter(
    (pair) => pair.sleepHours < 7
  );

  if (shortSleep.length < 4) return null;

  const lowEnergy = shortSleep.filter(
    (pair) => pair.nextEnergy <= 5
  );

  const rate = lowEnergy.length / shortSleep.length;

  if (rate < 0.6) return null;

  return {
    id: "sleep-energy",
    icon: "◒",
    category: "SLEEP → ENERGY",
    title: "Shorter sleep often precedes lower energy.",
    statement: `${ratioLabel(
      lowEnergy.length,
      shortSleep.length
    )} short-sleep days were followed by energy at 5/10 or below.`,
    detail:
      "Across your recent check-ins, nights below 7 hours were followed by lower next-day energy more often than not.",
    evidence: `Observed across ${shortSleep.length} short-sleep occasions.`,
    dates: lowEnergy
      .slice(-3)
      .map(
        (pair) =>
          `${formatDate(pair.sourceDate)} → ${formatDate(
            pair.followDate
          )}`
      ),
  };
}

function buildScreenSleepPattern(rows) {
  const observations = rows.slice(-8);

  if (observations.length < 7) return null;

  const candidates = observations
    .slice(0, -1)
    .map((row, index) => ({
      source: row,
      next: observations[index + 1],
    }))
    .sort((a, b) => b.source.screenTime - a.source.screenTime)
    .slice(0, Math.min(6, observations.length - 1));

  if (candidates.length < 4) return null;

  const baseline = [...observations]
    .map((row) => row.sleep)
    .sort((a, b) => a - b);

  const midpoint = Math.floor(baseline.length / 2);
  const median =
    baseline.length % 2 === 0
      ? (baseline[midpoint - 1] + baseline[midpoint]) / 2
      : baseline[midpoint];

  const shorterSleep = candidates.filter(
    (pair) => pair.next.sleep < median
  );

  const rate = shorterSleep.length / candidates.length;

  if (rate < 0.6) return null;

  return {
    id: "screen-sleep",
    icon: "□",
    category: "SCREEN TIME → SLEEP",
    title: "Higher screen-time days are often followed by shorter sleep.",
    statement: `${ratioLabel(
      shorterSleep.length,
      candidates.length
    )} of your highest screen-time days were followed by sleep below your recent median.`,
    detail:
      "This is an observed timing relationship in your check-in history, not proof that screen time caused the change.",
    evidence: `Compared the highest ${candidates.length} screen-time days with the following night's sleep.`,
    dates: shorterSleep
      .slice(-3)
      .map(
        (pair) =>
          `${formatDate(pair.source.date)} → ${formatDate(
            pair.next.date
          )}`
      ),
  };
}

function buildActivityMoodPattern(rows) {
  const observations = rows.slice(-8);

  const activeDays = observations.filter(
    (row) => row.steps > 7000
  );

  if (activeDays.length < 4) return null;

  const positiveMoodDays = activeDays.filter(
    (row) => moodScore(row.mood) >= 7
  );

  const rate =
    positiveMoodDays.length / activeDays.length;

  if (rate < 0.6) return null;

  return {
    id: "activity-mood",
    icon: "↗",
    category: "ACTIVITY → MOOD",
    title: "Higher-activity days line up with a more positive mood signal.",
    statement: `Your mood score was ≥7 on ${ratioLabel(
      positiveMoodDays.length,
      activeDays.length
    )} days when you exceeded 7,000 steps.`,
    detail:
      "Here, ≥7 is WELLsync's internal mood mapping from your recorded mood labels; it is a product signal, not a clinical mood scale.",
    evidence:
      "The relationship is based on the same-day values recorded in your recent check-ins.",
    dates: positiveMoodDays
      .slice(-3)
      .map((row) => formatDate(row.date)),
  };
}

function buildConsistencyPattern(rows, goals) {
  const observations = rows.slice(-7);

  if (observations.length < 5) return null;

  const targetSteps = Number(goals?.steps || 6000);
  const targetSleep = Number(goals?.sleep || 7);

  const balancedDays = observations.filter(
    (row) =>
      row.steps >= targetSteps &&
      row.sleep >= targetSleep &&
      row.stress <= 6
  );

  if (balancedDays.length < 3) return null;

  return {
    id: "balanced-rhythm",
    icon: "✦",
    category: "BALANCED RHYTHM",
    title: "Your strongest days share a repeatable baseline.",
    statement: `${balancedDays.length} of your last ${observations.length} days combined your movement and sleep targets while keeping stress at 6/10 or below.`,
    detail:
      "This pattern describes what your own check-ins looked like on stronger days; it does not establish a cause-and-effect relationship.",
    evidence:
      "Built from your selected goals and the signals recorded in the latest check-ins.",
    dates: balancedDays
      .slice(-3)
      .map((row) => formatDate(row.date)),
  };
}

function detectPatterns(history, goals) {
  const rows = normalizeHistory(history);

  if (rows.length < 4) {
    return {
      available: false,
      count: rows.length,
      patterns: [],
    };
  }

  const candidates = [
    buildSleepEnergyPattern(rows),
    buildScreenSleepPattern(rows),
    buildActivityMoodPattern(rows),
    buildConsistencyPattern(rows, goals),
  ].filter(Boolean);

  // Prefer the most directly data-linked relationships first.
  return {
    available: true,
    count: rows.length,
    patterns: candidates.slice(0, 4),
  };
}

export default function PersonalPatternEngine({
  history,
  goals,
  onNavigate,
}) {
  const analysis = useMemo(
    () => detectPatterns(history, goals),
    [history, goals]
  );

  if (!analysis.available) {
    return (
      <section className="pattern-engine-card glass-panel">
        <div className="pattern-engine-header">
          <div>
            <div className="pattern-engine-eyebrow">
              <span>✦</span> PERSONAL PATTERN ENGINE
            </div>
            <h2>Your patterns are still forming.</h2>
            <p>
              Keep completing check-ins. WELLsync will compare repeated
              relationships across sleep, energy, activity, mood and screen
              time as more of your own data becomes available.
            </p>
          </div>

          <button
            type="button"
            className="pattern-engine-link"
            onClick={() => onNavigate?.("insights")}
          >
            View insights <span>↗</span>
          </button>
        </div>

        <div className="pattern-engine-empty">
          <span>●</span>
          <strong>
            {analysis.count < 4
              ? "More check-ins unlock stronger pattern detection."
              : "No repeated pattern is strong enough to surface yet."}
          </strong>
        </div>
      </section>
    );
  }

  return (
    <section className="pattern-engine-card glass-panel">
      <div className="pattern-engine-header">
        <div>
          <div className="pattern-engine-eyebrow">
            <span>✦</span> PERSONAL PATTERN ENGINE
          </div>
          <h2>Discover what keeps repeating.</h2>
          <p>
            WELLsync looks for repeated relationships inside your own
            check-ins — and labels them as observations, not causes.
          </p>
        </div>

        <button
          type="button"
          className="pattern-engine-link"
          onClick={() => onNavigate?.("insights")}
        >
          Open insights <span>↗</span>
        </button>
      </div>

      {analysis.patterns.length === 0 ? (
        <div className="pattern-engine-empty">
          <span>◌</span>
          <div>
            <strong>No repeated relationship is strong enough yet.</strong>
            <p>
              WELLsync needs more consistent observations before surfacing a
              pattern.
            </p>
          </div>
        </div>
      ) : (
        <div className="pattern-engine-grid">
          {analysis.patterns.map((pattern) => (
            <article className="pattern-engine-item" key={pattern.id}>
              <div className="pattern-engine-item-top">
                <div className="pattern-engine-icon">
                  {pattern.icon}
                </div>
                <span>{pattern.category}</span>
              </div>

              <h3>{pattern.title}</h3>

              <div className="pattern-engine-statement">
                {pattern.statement}
              </div>

              <p>{pattern.detail}</p>

              <div className="pattern-engine-evidence">
                <span>OBSERVED IN YOUR DATA</span>
                <strong>{pattern.evidence}</strong>
                {pattern.dates?.length > 0 && (
                  <small>
                    Examples: {pattern.dates.join(" · ")}
                  </small>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="pattern-engine-footer">
        <span>
          Observed associations only · not a medical conclusion or proof of
          causation.
        </span>
        <span>{analysis.count} recent check-ins analyzed</span>
      </div>
    </section>
  );
}

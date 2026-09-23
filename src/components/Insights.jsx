import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  getCloudCheckins,
  getLatestCloudCheckin,
} from "../utils/supabaseData";

import {
  getWellnessHistory,
  getWellnessData,
} from "../utils/wellnessData";

import { calculateWellnessScore } from "../utils/wellnessScore";

import "../App.css";


/* =========================================================
   SAFE HELPERS
========================================================= */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    date: item.date || "",

    sleep: toNumber(
      item.sleep,
      0
    ),

    water: toNumber(
      item.water,
      0
    ),

    steps: toNumber(
      item.steps,
      0
    ),

    screenTime: toNumber(
      item.screenTime ??
        item.screen_time,
      0
    ),

    mood:
      item.mood ||
      "Okay",

    energy: toNumber(
      item.energy,
      5
    ),

    stress: toNumber(
      item.stress,
      5
    ),
  };
}


function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeItem)
    .filter(Boolean);
}


function formatDate(date) {
  if (!date) {
    return "";
  }

  const parsed =
    new Date(`${date}T00:00:00`);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(date);
  }

  return parsed.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
    }
  );
}


function average(values) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  );
}


/* =========================================================
   SCORE BREAKDOWN
========================================================= */

function getBreakdown(data) {
  if (!data) {
    return [];
  }

  const sleep =
    Math.min(
      data.sleep / 8,
      1
    ) * 100;

  const water =
    Math.min(
      data.water / 8,
      1
    ) * 100;

  const activity =
    Math.min(
      data.steps / 8000,
      1
    ) * 100;

  const screen =
    data.screenTime <= 4
      ? 100
      : Math.max(
          0,
          100 -
            (data.screenTime - 4) *
              15
        );

  const moodMap = {
    Great: 100,
    Good: 85,
    Okay: 65,
    Low: 40,
    Stressed: 25,
  };

  const mood =
    moodMap[data.mood] ?? 65;

  const energy =
    (data.energy / 10) *
    100;

  const stress =
    ((10 - data.stress) / 9) *
    100;

  return [
    {
      label: "Sleep",
      icon: "🌙",
      value: Math.round(sleep),
      weight: "20%",
    },
    {
      label: "Hydration",
      icon: "💧",
      value: Math.round(water),
      weight: "15%",
    },
    {
      label: "Activity",
      icon: "🚶",
      value: Math.round(activity),
      weight: "20%",
    },
    {
      label: "Screen balance",
      icon: "📱",
      value: Math.round(screen),
      weight: "10%",
    },
    {
      label: "Mood",
      icon: "🙂",
      value: Math.round(mood),
      weight: "15%",
    },
    {
      label: "Energy",
      icon: "⚡",
      value: Math.round(energy),
      weight: "10%",
    },
    {
      label: "Stress balance",
      icon: "🧠",
      value: Math.round(stress),
      weight: "10%",
    },
  ];
}


/* =========================================================
   CURRENT STRENGTHS / FOCUS
========================================================= */

function getSignals(data) {
  if (!data) {
    return {
      strengths: [],
      focus: [],
    };
  }

  const signals = [
    {
      name: "Sleep",
      icon: "🌙",
      score:
        Math.min(
          data.sleep / 8,
          1
        ) * 100,
      message:
        data.sleep >= 7
          ? "Your current sleep signal is supporting your routine."
          : "Sleep is one of the clearer areas you can work on.",
    },

    {
      name: "Hydration",
      icon: "💧",
      score:
        Math.min(
          data.water / 8,
          1
        ) * 100,
      message:
        data.water >= 6
          ? "Your hydration is in a solid range."
          : "Your hydration is currently below your default target.",
    },

    {
      name: "Activity",
      icon: "🚶",
      score:
        Math.min(
          data.steps / 8000,
          1
        ) * 100,
      message:
        data.steps >= 6000
          ? "Your movement level is supporting the day."
          : "Additional movement could strengthen your routine.",
    },

    {
      name: "Screen balance",
      icon: "📱",
      score:
        data.screenTime <= 4
          ? 100
          : Math.max(
              0,
              100 -
                (data.screenTime - 4) *
                  15
            ),
      message:
        data.screenTime <= 6
          ? "Your current screen-time signal is manageable."
          : "Screen time is one area worth watching.",
    },

    {
      name: "Energy",
      icon: "⚡",
      score:
        (data.energy / 10) *
        100,
      message:
        data.energy >= 7
          ? "Your energy signal is currently strong."
          : "Your energy signal has room for improvement.",
    },

    {
      name: "Stress balance",
      icon: "🧠",
      score:
        ((10 - data.stress) / 9) *
        100,
      message:
        data.stress <= 5
          ? "Your stress signal is relatively controlled."
          : "Stress is currently worth paying attention to.",
    },
  ];

  const strengths = [...signals]
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, 2);

  const focus = [...signals]
    .sort(
      (a, b) =>
        a.score - b.score
    )
    .slice(0, 2);

  return {
    strengths,
    focus,
  };
}


/* =========================================================
   PATTERNS
========================================================= */

function getPatterns(history) {
  if (history.length < 3) {
    return [
      {
        icon: "🔍",
        title:
          "Keep tracking to unlock personal patterns",
        text:
          "WELLsync needs several check-ins before it can identify repeated relationships in your data.",
      },
    ];
  }

  const patterns = [];

  const sleepStress =
    history.filter(
      (item) =>
        item.sleep < 7 &&
        item.stress >= 6
    ).length;

  if (
    sleepStress >=
    Math.ceil(
      history.length * 0.5
    )
  ) {
    patterns.push({
      icon: "🌙",
      title:
        "Sleep and stress may be moving together",
      text:
        "Several tracked days combine shorter sleep with higher stress signals. Keep tracking this relationship before treating it as a strong personal pattern.",
    });
  }

  const screenSleep =
    history.filter(
      (item) =>
        item.screenTime > 6 &&
        item.sleep < 7
    ).length;

  if (
    screenSleep >=
    Math.ceil(
      history.length * 0.5
    )
  ) {
    patterns.push({
      icon: "📱",
      title:
        "Higher screen-time days often overlap with shorter sleep",
      text:
        "Your tracked history shows repeated overlap between these two signals. This is an observation, not proof of causation.",
    });
  }

  const activityEnergy =
    history.filter(
      (item) =>
        item.steps >= 6000 &&
        item.energy >= 7
    ).length;

  if (
    activityEnergy >=
    Math.ceil(
      history.length * 0.5
    )
  ) {
    patterns.push({
      icon: "⚡",
      title:
        "Movement and energy often appear together",
      text:
        "Several tracked days combine 6,000+ steps with stronger energy signals.",
    });
  }

  const hydrationEnergy =
    history.filter(
      (item) =>
        item.water >= 6 &&
        item.energy >= 7
    ).length;

  if (
    hydrationEnergy >=
    Math.ceil(
      history.length * 0.5
    )
  ) {
    patterns.push({
      icon: "💧",
      title:
        "Higher hydration days often align with stronger energy",
      text:
        "Your history shows repeated days where higher hydration and stronger energy appear together.",
    });
  }

  if (!patterns.length) {
    patterns.push({
      icon: "📊",
      title:
        "Your personal pattern is still emerging",
      text:
        "WELLsync hasn't found a strong repeated relationship yet. Keep checking in consistently.",
    });
  }

  return patterns.slice(
    0,
    3
  );
}


/* =========================================================
   COMPONENT
========================================================= */

export default function Insights() {
  const [history, setHistory] =
    useState([]);

  const [latest, setLatest] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [source, setSource] =
    useState("local");

  const [error, setError] =
    useState("");


  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        let cloudHistory = [];
        let cloudLatest = null;

        /* -----------------------------------------------
           Try Supabase
        ----------------------------------------------- */

        try {
          const result =
            await getCloudCheckins();

          if (
            Array.isArray(result)
          ) {
            cloudHistory =
              result;
          }
        } catch (cloudError) {
          console.warn(
            "Insights cloud history unavailable:",
            cloudError
          );
        }

        try {
          cloudLatest =
            await getLatestCloudCheckin();
        } catch (cloudError) {
          console.warn(
            "Insights latest cloud record unavailable:",
            cloudError
          );
        }

        /* -----------------------------------------------
           Local fallback
        ----------------------------------------------- */

        let finalHistory =
          normalizeArray(
            cloudHistory
          );

        if (
          finalHistory.length === 0
        ) {
          try {
            finalHistory =
              normalizeArray(
                getWellnessHistory()
              );
          } catch (localError) {
            console.warn(
              "Insights local history unavailable:",
              localError
            );

            finalHistory = [];
          }
        }

        let finalLatest =
          normalizeItem(
            cloudLatest
          );

        if (!finalLatest) {
          try {
            finalLatest =
              normalizeItem(
                getWellnessData()
              );
          } catch (localError) {
            console.warn(
              "Insights local current data unavailable:",
              localError
            );
          }
        }

        finalHistory =
          finalHistory.sort(
            (a, b) =>
              new Date(a.date || 0) -
              new Date(b.date || 0)
          );

        if (
          !mounted
        ) {
          return;
        }

        setHistory(
          finalHistory
        );

        setLatest(
          finalLatest
        );

        setSource(
          cloudHistory.length > 0
            ? "cloud"
            : "local"
        );
      } catch (loadError) {
        console.error(
          "Insights failed to load:",
          loadError
        );

        if (mounted) {
          setError(
            "WELLsync could not load your insights right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);


  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const score =
    latest
      ? calculateWellnessScore(
          latest
        )
      : 0;

  const breakdown =
    useMemo(
      () =>
        getBreakdown(
          latest
        ),
      [latest]
    );

  const signals =
    useMemo(
      () =>
        getSignals(
          latest
        ),
      [latest]
    );

  const patterns =
    useMemo(
      () =>
        getPatterns(
          history
        ),
      [history]
    );

  const chartData =
    useMemo(
      () =>
        history
          .slice(-7)
          .map((item) => ({
            date:
              formatDate(
                item.date
              ),
            score:
              calculateWellnessScore(
                item
              ),
          })),
      [history]
    );

  const averageScore =
    useMemo(() => {
      if (!history.length) {
        return 0;
      }

      return Math.round(
        average(
          history.map(
            (item) =>
              calculateWellnessScore(
                item
              )
          )
        )
      );
    }, [history]);


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="insights-loading">
        <div className="loading-spinner" />

        <p>
          Analyzing your wellness data...
        </p>
      </div>
    );
  }


  /* =======================================================
     ERROR
  ======================================================= */

  if (
    error &&
    !latest
  ) {
    return (
      <div className="insights-page">

        <div className="insights-header">

          <div>

            <p className="dashboard-eyebrow">
              PERSONAL WELLNESS INTELLIGENCE
            </p>

            <h1>
              Understand your{" "}
              <span>
                patterns.
              </span>
            </h1>

          </div>

        </div>

        <div className="insights-empty-state">

          <div className="insights-empty-icon">
            !
          </div>

          <h2>
            We couldn't load your insights
          </h2>

          <p>
            Please refresh the page and try
            again. Your existing wellness data
            has not been changed.
          </p>

        </div>

      </div>
    );
  }


  /* =======================================================
     NO CURRENT DATA
  ======================================================= */

  if (!latest) {
    return (
      <div className="insights-page">

        <div className="insights-header">

          <div>

            <p className="dashboard-eyebrow">
              PERSONAL WELLNESS INTELLIGENCE
            </p>

            <h1>
              Understand your{" "}
              <span>
                patterns.
              </span>
            </h1>

            <p className="insights-subtitle">
              WELLsync turns everyday check-ins
              into useful personal insights.
            </p>

          </div>

        </div>


        <div className="insights-empty-state">

          <div className="insights-empty-icon">
            ✦
          </div>

          <h2>
            Your first insight is one check-in away.
          </h2>

          <p>
            Complete your Daily Check-In and
            WELLsync will start analyzing your
            wellness signals.
          </p>

        </div>

      </div>
    );
  }


  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="insights-page">

      {/* HEADER */}

      <div className="insights-header">

        <div>

          <p className="dashboard-eyebrow">
            PERSONAL WELLNESS INTELLIGENCE
          </p>

          <h1>
            Understand your{" "}
            <span>
              patterns.
            </span>
          </h1>

          <p className="insights-subtitle">
            WELLsync turns your daily signals
            into understandable patterns and
            practical next steps.
          </p>

        </div>


        <div className="insights-sync-pill">

          <span />

          {source === "cloud"
            ? "Synced with Supabase"
            : "Saved locally"}

        </div>

      </div>


      {/* OVERVIEW */}

      <section className="insights-overview-grid">

        <div className="insights-score-card">

          <div
            className="insights-score-ring"
            style={{
              background:
                `conic-gradient(
                  #7c5cff ${
                    score * 3.6
                  }deg,
                  rgba(255,255,255,0.07) ${
                    score * 3.6
                  }deg
                )`,
            }}
          >

            <div>

              <strong>
                {score}
              </strong>

              <span>
                /100
              </span>

            </div>

          </div>


          <div className="insights-score-copy">

            <p className="dashboard-card-label">
              CURRENT WELLNESS SIGNAL
            </p>

            <h2>
              {score >= 85
                ? "Strong rhythm"
                : score >= 70
                  ? "Good momentum"
                  : score >= 50
                    ? "Room to improve"
                    : "Reset opportunity"}
            </h2>

            <p>
              {score >= 85
                ? "Your tracked signals are broadly balanced today."
                : score >= 70
                  ? "Your routine has a solid foundation with a few areas to refine."
                  : score >= 50
                    ? "There are a few clear areas worth improving."
                    : "Several signals need attention. Start with one small change."}
            </p>

          </div>

        </div>


        <div className="insights-stat-card">

          <p className="dashboard-card-label">
            DAYS TRACKED
          </p>

          <strong>
            {history.length}
          </strong>

          <span>
            check-in
            {history.length === 1
              ? ""
              : "s"}
          </span>

          <div className="insights-stat-footer">
            {history.length >= 3
              ? "Pattern analysis active"
              : "Building baseline"}
          </div>

        </div>


        <div className="insights-stat-card">

          <p className="dashboard-card-label">
            AVERAGE SCORE
          </p>

          <strong>
            {averageScore}
          </strong>

          <span>
            across tracked days
          </span>

          <div className="insights-stat-footer">
            Current: {score}/100
          </div>

        </div>

      </section>


      {/* BREAKDOWN */}

      <section className="insights-section">

        <div className="insights-section-heading">

          <div>

            <p className="dashboard-card-label">
              SCORE BREAKDOWN
            </p>

            <h2>
              What is driving your score
            </h2>

          </div>

        </div>


        <div className="insights-breakdown-grid">

          {breakdown.map(
            (item) => (
              <div
                className="insights-breakdown-card"
                key={item.label}
              >

                <div className="insights-breakdown-top">

                  <span className="insights-signal-icon">
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>

                  <small>
                    {item.weight}
                  </small>

                </div>


                <div className="insights-breakdown-value">

                  {item.value}

                  <span>
                    /100
                  </span>

                </div>


                <div className="insights-progress-track">

                  <div
                    className="insights-progress-fill"
                    style={{
                      width:
                        `${Math.max(
                          0,
                          Math.min(
                            100,
                            item.value
                          )
                        )}%`,
                    }}
                  />

                </div>

              </div>
            )
          )}

        </div>

      </section>


      {/* TREND */}

      <section className="insights-chart-card">

        <div className="insights-chart-header">

          <div>

            <p className="dashboard-card-label">
              RECENT TREND
            </p>

            <h2>
              Wellness over time
            </h2>

          </div>

        </div>


        {chartData.length >= 2 ? (
          <div className="insights-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={chartData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                />

                <XAxis
                  dataKey="date"
                  stroke="#687184"
                  tick={{
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={[
                    0,
                    100,
                  ]}
                  stroke="#687184"
                  tick={{
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    background:
                      "#15191f",
                    border:
                      "1px solid rgba(255,255,255,0.09)",
                    borderRadius:
                      "12px",
                    color:
                      "#e3e6eb",
                  }}
                  formatter={(
                    value
                  ) => [
                    `${value}/100`,
                    "Wellness",
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#8b77ff"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#8b77ff",
                    stroke:
                      "#15191f",
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>
        ) : (
          <div className="insights-chart-empty">

            <span>
              📈
            </span>

            <p>
              Keep checking in. Your wellness
              trend will appear after at least
              two tracked days.
            </p>

          </div>
        )}

      </section>


      {/* STRENGTH + FOCUS */}

      <section className="insights-two-column">

        <div className="insights-highlight-card">

          <div className="insights-card-heading">

            <p className="dashboard-card-label">
              YOUR STRENGTHS
            </p>

            <h2>
              What's working
            </h2>

          </div>


          <div className="insights-highlight-list">

            {signals.strengths.map(
              (item) => (
                <div
                  className="insights-highlight-item positive"
                  key={item.name}
                >

                  <div className="insights-highlight-icon">
                    {item.icon}
                  </div>

                  <div>

                    <strong>
                      {item.name}
                    </strong>

                    <p>
                      {item.message}
                    </p>

                  </div>

                </div>
              )
            )}

          </div>

        </div>


        <div className="insights-highlight-card">

          <div className="insights-card-heading">

            <p className="dashboard-card-label">
              NEXT OPPORTUNITIES
            </p>

            <h2>
              What to focus on
            </h2>

          </div>


          <div className="insights-highlight-list">

            {signals.focus.map(
              (item) => (
                <div
                  className="insights-highlight-item"
                  key={item.name}
                >

                  <div className="insights-highlight-icon">
                    {item.icon}
                  </div>

                  <div>

                    <strong>
                      {item.name}
                    </strong>

                    <p>
                      {item.message}
                    </p>

                  </div>

                </div>
              )
            )}

          </div>

        </div>

      </section>


      {/* PATTERNS */}

      <section className="insights-pattern-section">

        <div className="insights-section-heading">

          <div>

            <p className="dashboard-card-label">
              PERSONAL PATTERN DETECTION
            </p>

            <h2>
              What WELLsync is noticing
            </h2>

          </div>

          <span className="insights-ai-badge">
            ✦ PATTERN INTELLIGENCE
          </span>

        </div>


        <div className="insights-pattern-grid">

          {patterns.map(
            (pattern, index) => (
              <div
                className="insights-pattern-card"
                key={`${pattern.title}-${index}`}
              >

                <div className="insights-pattern-icon">
                  {pattern.icon}
                </div>

                <div>

                  <h3>
                    {pattern.title}
                  </h3>

                  <p>
                    {pattern.text}
                  </p>

                </div>

              </div>
            )
          )}

        </div>

      </section>


      {/* TAKEAWAY */}

      <section className="insights-takeaway">

        <div className="insights-takeaway-icon">
          ✦
        </div>

        <div>

          <p className="dashboard-card-label">
            WELLSYNC TAKEAWAY
          </p>

          <h2>
            Your data should lead to action,
            not just another dashboard.
          </h2>

          <p>
            {signals.focus.length
              ? `${signals.focus[0].name} is currently one of the clearest areas to work on. Start small, stay consistent, and let future check-ins reveal whether the change actually helps.`
              : "Your current signals are relatively balanced. Keep tracking consistently so WELLsync can learn more about your routine."}
          </p>

        </div>

      </section>

    </div>
  );
}
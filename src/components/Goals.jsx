import { useEffect, useMemo, useState } from "react";

import {
  getCloudGoals,
  saveCloudGoals,
  getCloudCheckins,
} from "../utils/supabaseData";

import {
  getGoals,
  saveGoals,
} from "../utils/wellnessData";

import "../App.css";


/* =========================================================
   HELPERS
========================================================= */

function normalizeGoals(data) {
  if (!data) {
    return {
      sleep: 7,
      water: 6,
      steps: 6000,
      screenTime: 6,
    };
  }

  return {
    sleep: Number(data.sleep ?? 7),
    water: Number(data.water ?? 6),
    steps: Number(data.steps ?? 6000),
    screenTime: Number(
      data.screenTime ??
      data.screen_time ??
      6
    ),
  };
}


function normalizeCheckin(item) {
  if (!item) return null;

  return {
    date: item.date || "",
    sleep: Number(item.sleep ?? 0),
    water: Number(item.water ?? 0),
    steps: Number(item.steps ?? 0),
    screenTime: Number(
      item.screenTime ??
      item.screen_time ??
      0
    ),
  };
}


function getProgress(
  current,
  target,
  higherIsBetter = true
) {
  if (!target || target <= 0) {
    return 0;
  }

  let percentage;

  if (higherIsBetter) {
    percentage =
      (current / target) * 100;
  } else {
    percentage =
      current <= target
        ? 100
        : (target / current) * 100;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(percentage)
    )
  );
}


function getGoalStatus(
  progress
) {
  if (progress >= 100) {
    return "Complete";
  }

  if (progress >= 80) {
    return "Almost there";
  }

  if (progress >= 50) {
    return "In progress";
  }

  return "Just getting started";
}


function getDateKey(date) {
  if (!date) return "";

  return String(date).slice(0, 10);
}


function isGoalCompleted(
  checkin,
  goals
) {
  if (!checkin) return false;

  return (
    checkin.sleep >= goals.sleep &&
    checkin.water >= goals.water &&
    checkin.steps >= goals.steps &&
    checkin.screenTime <= goals.screenTime
  );
}


/* =========================================================
   COMPONENT
========================================================= */

export default function Goals() {
  const [goals, setGoals] =
    useState(
      normalizeGoals()
    );

  const [checkins, setCheckins] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [source, setSource] =
    useState("local");


  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    async function loadGoals() {
      setLoading(true);

      let cloudGoals = null;
      let cloudCheckins = [];

      try {
        cloudGoals =
          await getCloudGoals();
      } catch (error) {
        console.warn(
          "Goals cloud data unavailable:",
          error
        );
      }

      try {
        cloudCheckins =
          await getCloudCheckins();
      } catch (error) {
        console.warn(
          "Goals cloud check-ins unavailable:",
          error
        );
      }

      if (cloudGoals) {
        setGoals(
          normalizeGoals(
            cloudGoals
          )
        );

        setSource("cloud");
      } else {
        try {
          setGoals(
            normalizeGoals(
              getGoals()
            )
          );
        } catch (error) {
          console.warn(
            "Local goals unavailable:",
            error
          );
        }

        setSource("local");
      }

      if (
        Array.isArray(
          cloudCheckins
        ) &&
        cloudCheckins.length
      ) {
        setCheckins(
          cloudCheckins
            .map(
              normalizeCheckin
            )
            .filter(Boolean)
        );
      }

      setLoading(false);
    }

    loadGoals();
  }, []);


  /* =======================================================
     CURRENT CHECK-IN
  ======================================================= */

  const latest =
    checkins[
      checkins.length - 1
    ] || null;


  /* =======================================================
     GOAL PROGRESS
  ======================================================= */

  const goalMetrics =
    useMemo(() => {
      if (!latest) {
        return [
          {
            key: "sleep",
            label: "Sleep",
            icon: "🌙",
            current: 0,
            target: goals.sleep,
            unit: "h",
            progress: 0,
            higherIsBetter: true,
          },
          {
            key: "water",
            label: "Hydration",
            icon: "💧",
            current: 0,
            target: goals.water,
            unit: " glasses",
            progress: 0,
            higherIsBetter: true,
          },
          {
            key: "steps",
            label: "Activity",
            icon: "🚶",
            current: 0,
            target: goals.steps,
            unit: " steps",
            progress: 0,
            higherIsBetter: true,
          },
          {
            key: "screenTime",
            label: "Screen time",
            icon: "📱",
            current: 0,
            target: goals.screenTime,
            unit: "h",
            progress: 0,
            higherIsBetter: false,
          },
        ];
      }

      return [
        {
          key: "sleep",
          label: "Sleep",
          icon: "🌙",
          current: latest.sleep,
          target: goals.sleep,
          unit: "h",
          progress: getProgress(
            latest.sleep,
            goals.sleep,
            true
          ),
          higherIsBetter: true,
        },

        {
          key: "water",
          label: "Hydration",
          icon: "💧",
          current: latest.water,
          target: goals.water,
          unit: " glasses",
          progress: getProgress(
            latest.water,
            goals.water,
            true
          ),
          higherIsBetter: true,
        },

        {
          key: "steps",
          label: "Activity",
          icon: "🚶",
          current: latest.steps,
          target: goals.steps,
          unit: " steps",
          progress: getProgress(
            latest.steps,
            goals.steps,
            true
          ),
          higherIsBetter: true,
        },

        {
          key: "screenTime",
          label: "Screen time",
          icon: "📱",
          current: latest.screenTime,
          target: goals.screenTime,
          unit: "h",
          progress: getProgress(
            latest.screenTime,
            goals.screenTime,
            false
          ),
          higherIsBetter: false,
        },
      ];
    }, [latest, goals]);


  const overallProgress =
    Math.round(
      goalMetrics.reduce(
        (sum, item) =>
          sum + item.progress,
        0
      ) /
        goalMetrics.length
    );


  /* =======================================================
     STREAK
  ======================================================= */

  const streakData =
    useMemo(() => {
      if (!checkins.length) {
        return {
          current: 0,
          best: 0,
        };
      }

      const sorted = [
        ...checkins,
      ].sort(
        (a, b) =>
          new Date(
            a.date
          ) -
          new Date(
            b.date
          )
      );

      let current = 0;
      let best = 0;
      let running = 0;

      for (
        let i = 0;
        i < sorted.length;
        i++
      ) {
        const completed =
          isGoalCompleted(
            sorted[i],
            goals
          );

        if (completed) {
          running += 1;
          best = Math.max(
            best,
            running
          );
        } else {
          running = 0;
        }
      }

      for (
        let i = sorted.length - 1;
        i >= 0;
        i--
      ) {
        if (
          isGoalCompleted(
            sorted[i],
            goals
          )
        ) {
          current += 1;
        } else {
          break;
        }
      }

      return {
        current,
        best,
      };
    }, [checkins, goals]);


  /* =======================================================
     FOCUS AREA
  ======================================================= */

  const focusMetric =
    useMemo(() => {
      if (!goalMetrics.length) {
        return null;
      }

      return [...goalMetrics].sort(
        (a, b) =>
          a.progress -
          b.progress
      )[0];
    }, [goalMetrics]);


  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    try {
      saveGoals(goals);

      try {
        await saveCloudGoals(
          goals
        );

        setSource("cloud");
      } catch (cloudError) {
        console.warn(
          "Cloud goal save failed. Local copy preserved:",
          cloudError
        );
      }

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } finally {
      setSaving(false);
    }
  }


  /* =======================================================
     INPUT HANDLER
  ======================================================= */

  function updateGoal(
    key,
    value
  ) {
    setGoals(
      (current) => ({
        ...current,
        [key]: Number(value),
      })
    );

    setSaved(false);
  }


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="goals-loading">
        <div className="loading-spinner" />

        <p>
          Loading your goals...
        </p>
      </div>
    );
  }


  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="goals-page">

      {/* HEADER */}

      <div className="goals-header">

        <div>

          <p className="dashboard-eyebrow">
            YOUR PERSONAL TARGETS
          </p>

          <h1>
            Build your{" "}
            <span>
              ideal rhythm.
            </span>
          </h1>

          <p className="goals-subtitle">
            Set realistic targets and let WELLsync
            track how your everyday habits move
            toward them.
          </p>

        </div>


        <div className="goals-sync-pill">

          <span />

          {source === "cloud"
            ? "Synced with Supabase"
            : "Saved locally"}

        </div>

      </div>


      {/* OVERVIEW */}

      <section className="goals-overview">

        <div className="goals-overview-main">

          <div>

            <p className="dashboard-card-label">
              TODAY'S GOAL PROGRESS
            </p>

            <h2>
              {overallProgress}%
            </h2>

            <p>
              {overallProgress >= 90
                ? "You're very close to completing your current targets."
                : overallProgress >= 70
                  ? "You're making strong progress toward your targets."
                  : overallProgress >= 50
                    ? "You're halfway there. Small actions can close the gaps."
                    : "Start with the easiest goal to build momentum."}
            </p>

          </div>


          <div
            className="goals-overview-ring"
            style={{
              background:
                `conic-gradient(
                  #7c5cff ${
                    overallProgress * 3.6
                  }deg,
                  rgba(255,255,255,0.07) ${
                    overallProgress * 3.6
                  }deg
                )`,
            }}
          >

            <div>

              <strong>
                {overallProgress}
              </strong>

              <span>
                %
              </span>

            </div>

          </div>

        </div>


        <div className="goals-streak-card">

          <div>
            <p className="dashboard-card-label">
              CURRENT STREAK
            </p>

            <strong>
              {streakData.current}
            </strong>

            <span>
              day
              {streakData.current === 1
                ? ""
                : "s"}
            </span>
          </div>

          <div className="goals-streak-fire">
            🔥
          </div>

        </div>


        <div className="goals-streak-card">

          <div>
            <p className="dashboard-card-label">
              BEST STREAK
            </p>

            <strong>
              {streakData.best}
            </strong>

            <span>
              day
              {streakData.best === 1
                ? ""
                : "s"}
            </span>
          </div>

          <div className="goals-streak-fire">
            ✦
          </div>

        </div>

      </section>


      {/* TODAY'S PROGRESS */}

      <section className="goals-section">

        <div className="goals-section-heading">

          <div>

            <p className="dashboard-card-label">
              TODAY'S PROGRESS
            </p>

            <h2>
              Your targets
            </h2>

          </div>

        </div>


        <div className="goals-metrics-grid">

          {goalMetrics.map(
            (metric) => (
              <div
                className="goal-progress-card"
                key={metric.key}
              >

                <div className="goal-progress-top">

                  <div className="goal-progress-icon">
                    {metric.icon}
                  </div>

                  <div>

                    <strong>
                      {metric.label}
                    </strong>

                    <span>
                      {getGoalStatus(
                        metric.progress
                      )}
                    </span>

                  </div>

                </div>


                <div className="goal-progress-values">

                  <strong>
                    {metric.key ===
                    "steps"
                      ? Number(
                          metric.current
                        ).toLocaleString()
                      : metric.current}

                    <span>
                      {metric.unit}
                    </span>
                  </strong>

                  <span>
                    Target{" "}
                    {metric.target}
                    {metric.unit}
                  </span>

                </div>


                <div className="goal-progress-track">

                  <div
                    className="goal-progress-fill"
                    style={{
                      width:
                        `${metric.progress}%`,
                    }}
                  />

                </div>


                <div className="goal-progress-footer">

                  <span>
                    {metric.progress}%
                  </span>

                  {metric.progress >= 100
                    ? "Goal achieved"
                    : metric.higherIsBetter
                      ? "Keep moving toward target"
                      : "Lower is better"}

                </div>

              </div>
            )
          )}

        </div>

      </section>


      {/* GOAL SETTINGS */}

      <section className="goals-settings-card">

        <div className="goals-settings-heading">

          <div>

            <p className="dashboard-card-label">
              PERSONALIZE YOUR TARGETS
            </p>

            <h2>
              Your wellness goals
            </h2>

          </div>

          <span>
            Changes sync to your account
          </span>

        </div>


        <div className="goals-form-grid">

          <label className="goal-input-card">

            <span>
              🌙 Sleep
            </span>

            <div>

              <input
                type="number"
                min="1"
                max="12"
                step="0.5"
                value={goals.sleep}
                onChange={(event) =>
                  updateGoal(
                    "sleep",
                    event.target.value
                  )
                }
              />

              <small>
                hours
              </small>

            </div>

          </label>


          <label className="goal-input-card">

            <span>
              💧 Water
            </span>

            <div>

              <input
                type="number"
                min="1"
                max="20"
                value={goals.water}
                onChange={(event) =>
                  updateGoal(
                    "water",
                    event.target.value
                  )
                }
              />

              <small>
                glasses
              </small>

            </div>

          </label>


          <label className="goal-input-card">

            <span>
              🚶 Steps
            </span>

            <div>

              <input
                type="number"
                min="500"
                max="50000"
                step="500"
                value={goals.steps}
                onChange={(event) =>
                  updateGoal(
                    "steps",
                    event.target.value
                  )
                }
              />

              <small>
                steps
              </small>

            </div>

          </label>


          <label className="goal-input-card">

            <span>
              📱 Screen time
            </span>

            <div>

              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={goals.screenTime}
                onChange={(event) =>
                  updateGoal(
                    "screenTime",
                    event.target.value
                  )
                }
              />

              <small>
                max hours
              </small>

            </div>

          </label>

        </div>


        <div className="goals-save-row">

          <div>

            {saved && (
              <span className="goals-saved-message">
                ✓ Goals saved successfully
              </span>
            )}

          </div>


          <button
            className="goals-save-button"
            onClick={
              handleSave
            }
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save goals →"}
          </button>

        </div>

      </section>


      {/* FOCUS */}

      <section className="goals-focus-card">

        <div className="goals-focus-icon">
          {focusMetric?.key === "sleep"
            ? "🌙"
            : focusMetric?.key === "water"
              ? "💧"
              : focusMetric?.key === "steps"
                ? "🚶"
                : "📱"}
        </div>


        <div>

          <p className="dashboard-card-label">
            NEXT BEST FOCUS
          </p>

          <h2>
            {focusMetric
              ? focusMetric.label
              : "Consistency"}
          </h2>

          <p>
            {focusMetric
              ? focusMetric.progress >= 100
                ? `Your ${focusMetric.label.toLowerCase()} target is already complete. Keep it consistent.`
                : `This is currently your largest goal gap. Small, realistic actions here can improve your overall goal progress.`
              : "Keep building your routine consistently."}
          </p>

        </div>

      </section>

    </div>
  );
}
import { useEffect, useMemo, useState } from "react";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { getCloudCheckins } from "../utils/supabaseData";
import { getWellnessHistory } from "../utils/wellnessData";
import { calculateWellnessScore } from "../utils/wellnessScore";

import "../App.css";


function normalize(item) {
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
    mood: item.mood || "Okay",
    energy: Number(item.energy ?? 5),
    stress: Number(item.stress ?? 5),
  };
}


function formatDate(date) {
  if (!date) return "";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return String(date);
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}


function average(values) {
  if (!values.length) return 0;

  return (
    values.reduce(
      (sum, value) => sum + Number(value),
      0
    ) / values.length
  );
}


function round(value) {
  return Math.round(value * 10) / 10;
}


function getTrend(values) {
  if (values.length < 2) return "stable";

  const midpoint = Math.floor(values.length / 2);

  const first = average(
    values.slice(0, midpoint)
  );

  const second = average(
    values.slice(midpoint)
  );

  if (second - first >= 3) return "up";
  if (second - first <= -3) return "down";

  return "stable";
}


function getTrendText(trend) {
  if (trend === "up") return "Improving";
  if (trend === "down") return "Needs attention";
  return "Holding steady";
}


export default function Analytics() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("local");


  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);

      let data = [];

      try {
        const cloud = await getCloudCheckins();

        if (Array.isArray(cloud)) {
          data = cloud;
        }

        if (cloud?.length) {
          setSource("cloud");
        }
      } catch (error) {
        console.warn(
          "Analytics cloud data unavailable:",
          error
        );
      }

      if (!data.length) {
        try {
          data = getWellnessHistory();
          setSource("local");
        } catch (error) {
          console.warn(
            "Analytics local history unavailable:",
            error
          );

          data = [];
        }
      }

      const normalized = data
        .map(normalize)
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(a.date || 0) -
            new Date(b.date || 0)
        );

      setHistory(normalized);
      setLoading(false);
    }

    loadAnalytics();
  }, []);


  const scoredHistory = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        score: calculateWellnessScore(item),
      })),
    [history]
  );


  const current =
    scoredHistory[scoredHistory.length - 1] ||
    null;


  const currentScore =
    current?.score ?? 0;


  const averageScore = useMemo(() => {
    if (!scoredHistory.length) return 0;

    return Math.round(
      average(
        scoredHistory.map(
          (item) => item.score
        )
      )
    );
  }, [scoredHistory]);


  const bestDay = useMemo(() => {
    if (!scoredHistory.length) return null;

    return scoredHistory.reduce(
      (best, item) =>
        item.score > best.score
          ? item
          : best
    );
  }, [scoredHistory]);


  const lowestDay = useMemo(() => {
    if (!scoredHistory.length) return null;

    return scoredHistory.reduce(
      (lowest, item) =>
        item.score < lowest.score
          ? item
          : lowest
    );
  }, [scoredHistory]);


  const trend = useMemo(
    () =>
      getTrend(
        scoredHistory
          .slice(-7)
          .map((item) => item.score)
      ),
    [scoredHistory]
  );


  const habitAverages = useMemo(() => {
    if (!history.length) return null;

    return {
      sleep: round(
        average(
          history.map(
            (item) => item.sleep
          )
        )
      ),

      water: round(
        average(
          history.map(
            (item) => item.water
          )
        )
      ),

      steps: Math.round(
        average(
          history.map(
            (item) => item.steps
          )
        )
      ),

      screenTime: round(
        average(
          history.map(
            (item) => item.screenTime
          )
        )
      ),

      energy: round(
        average(
          history.map(
            (item) => item.energy
          )
        )
      ),

      stress: round(
        average(
          history.map(
            (item) => item.stress
          )
        )
      ),
    };
  }, [history]);


  const trendChartData = scoredHistory
    .slice(-7)
    .map((item) => ({
      date: formatDate(item.date),
      score: item.score,
    }));


  const habitChartData = habitAverages
    ? [
        {
          label: "Sleep",
          value: habitAverages.sleep,
        },
        {
          label: "Water",
          value: habitAverages.water,
        },
        {
          label: "Energy",
          value: habitAverages.energy,
        },
        {
          label: "Stress",
          value: habitAverages.stress,
        },
      ]
    : [];


  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner" />
        <p>
          Building your wellness analytics...
        </p>
      </div>
    );
  }


  if (!history.length) {
    return (
      <div className="analytics-page">

        <div className="analytics-header">
          <div>
            <p className="dashboard-eyebrow">
              WELLNESS DATA INTELLIGENCE
            </p>

            <h1>
              See your{" "}
              <span>progress.</span>
            </h1>

            <p className="analytics-subtitle">
              Keep checking in and WELLsync will turn
              your wellness history into meaningful trends.
            </p>
          </div>
        </div>


        <div className="analytics-empty-state">
          <div className="analytics-empty-icon">
            📊
          </div>

          <h2>
            Your analytics are waiting for data.
          </h2>

          <p>
            Complete more Daily Check-Ins to build
            your personal wellness history.
          </p>
        </div>

      </div>
    );
  }


  return (
    <div className="analytics-page">

      {/* HEADER */}

      <div className="analytics-header">

        <div>
          <p className="dashboard-eyebrow">
            WELLNESS DATA INTELLIGENCE
          </p>

          <h1>
            See your{" "}
            <span>progress.</span>
          </h1>

          <p className="analytics-subtitle">
            Turn your daily check-ins into trends,
            averages, and useful progress signals.
          </p>
        </div>


        <div className="analytics-sync-pill">
          <span />
          {source === "cloud"
            ? "Synced with Supabase"
            : "Saved locally"}
        </div>

      </div>


      {/* TOP STATS */}

      <section className="analytics-stats-grid">

        <div className="analytics-stat-card primary">

          <p className="dashboard-card-label">
            CURRENT SCORE
          </p>

          <strong>
            {currentScore}
            <span>/100</span>
          </strong>

          <p>
            {currentScore >= 85
              ? "Strong rhythm"
              : currentScore >= 70
                ? "Good momentum"
                : currentScore >= 50
                  ? "Room to improve"
                  : "Reset opportunity"}
          </p>

        </div>


        <div className="analytics-stat-card">

          <p className="dashboard-card-label">
            AVERAGE SCORE
          </p>

          <strong>
            {averageScore}
          </strong>

          <p>
            Across {history.length} tracked day
            {history.length === 1 ? "" : "s"}
          </p>

        </div>


        <div className="analytics-stat-card">

          <p className="dashboard-card-label">
            BEST DAY
          </p>

          <strong>
            {bestDay?.score ?? "—"}
          </strong>

          <p>
            {bestDay
              ? formatDate(bestDay.date)
              : "—"}
          </p>

        </div>


        <div className="analytics-stat-card">

          <p className="dashboard-card-label">
            TREND
          </p>

          <strong>
            {trend === "up"
              ? "↗"
              : trend === "down"
                ? "↘"
                : "→"}
          </strong>

          <p>
            {getTrendText(trend)}
          </p>

        </div>

      </section>


      {/* TREND CHART */}

      <section className="analytics-chart-card">

        <div className="analytics-card-heading">

          <div>
            <p className="dashboard-card-label">
              WELLNESS TREND
            </p>

            <h2>
              Your recent performance
            </h2>
          </div>

          <span className="analytics-trend-pill">
            {getTrendText(trend)}
          </span>

        </div>


        {trendChartData.length >= 2 ? (
          <div className="analytics-main-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={trendChartData}
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
                  domain={[0, 100]}
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
                  formatter={(value) => [
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
                    stroke: "#15191f",
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
          <div className="analytics-chart-empty">
            <span>📈</span>
            <p>
              Keep checking in to unlock your wellness trend.
            </p>
          </div>
        )}

      </section>


      {/* HABIT AVERAGES */}

      {habitAverages && (
        <section className="analytics-two-column">

          <div className="analytics-habits-card">

            <div className="analytics-card-heading">
              <div>
                <p className="dashboard-card-label">
                  HABIT AVERAGES
                </p>

                <h2>
                  Your typical day
                </h2>
              </div>
            </div>


            <div className="analytics-habit-list">

              <div>
                <span>🌙 Sleep</span>
                <strong>
                  {habitAverages.sleep}h
                </strong>
              </div>

              <div>
                <span>💧 Water</span>
                <strong>
                  {habitAverages.water}
                  {" "}glasses
                </strong>
              </div>

              <div>
                <span>🚶 Steps</span>
                <strong>
                  {habitAverages.steps.toLocaleString()}
                </strong>
              </div>

              <div>
                <span>📱 Screen time</span>
                <strong>
                  {habitAverages.screenTime}h
                </strong>
              </div>

              <div>
                <span>⚡ Energy</span>
                <strong>
                  {habitAverages.energy}/10
                </strong>
              </div>

              <div>
                <span>🧠 Stress</span>
                <strong>
                  {habitAverages.stress}/10
                </strong>
              </div>

            </div>

          </div>


          <div className="analytics-habits-card">

            <div className="analytics-card-heading">
              <div>
                <p className="dashboard-card-label">
                  HABIT SIGNALS
                </p>

                <h2>
                  Daily averages
                </h2>
              </div>
            </div>


            <div className="analytics-habit-chart">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={habitChartData}
                  margin={{
                    top: 8,
                    right: 5,
                    left: -20,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />

                  <XAxis
                    dataKey="label"
                    stroke="#687184"
                    tick={{
                      fontSize: 10,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    stroke="#687184"
                    tick={{
                      fontSize: 10,
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
                  />

                  <Bar
                    dataKey="value"
                    fill="#7c5cff"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          </div>

        </section>
      )}


      {/* PERFORMANCE SUMMARY */}

      <section className="analytics-summary-grid">

        <div className="analytics-summary-card">

          <p className="dashboard-card-label">
            BEST PERFORMANCE
          </p>

          <h3>
            {bestDay
              ? `${bestDay.score}/100 on ${formatDate(bestDay.date)}`
              : "—"}
          </h3>

          <p>
            Your strongest tracked day gives you
            a useful reference point for understanding
            what a good routine looks like for you.
          </p>

        </div>


        <div className="analytics-summary-card">

          <p className="dashboard-card-label">
            LOWEST PERFORMANCE
          </p>

          <h3>
            {lowestDay
              ? `${lowestDay.score}/100 on ${formatDate(lowestDay.date)}`
              : "—"}
          </h3>

          <p>
            A lower score isn't a failure. It gives
            WELLsync another data point to compare
            against stronger days.
          </p>

        </div>


        <div className="analytics-summary-card">

          <p className="dashboard-card-label">
            WELLNESS TAKEAWAY
          </p>

          <h3>
            {trend === "up"
              ? "Your recent signals are moving in a positive direction."
              : trend === "down"
                ? "Your recent data suggests there is room to reset."
                : "Your recent routine is relatively consistent."}
          </h3>

          <p>
            Keep tracking consistently so WELLsync
            can distinguish one unusual day from
            a genuine personal pattern.
          </p>

        </div>

      </section>


      {/* RECENT DAYS */}

      <section className="analytics-recent-card">

        <div className="analytics-card-heading">

          <div>
            <p className="dashboard-card-label">
              RECENT PERFORMANCE
            </p>

            <h2>
              Your latest check-ins
            </h2>
          </div>

        </div>


        <div className="analytics-recent-list">

          {scoredHistory
            .slice()
            .reverse()
            .slice(0, 7)
            .map((item) => (
              <div
                className="analytics-recent-row"
                key={`${item.date}-${item.score}`}
              >

                <div>
                  <strong>
                    {formatDate(
                      item.date
                    )}
                  </strong>

                  <span>
                    {item.mood}
                  </span>
                </div>


                <div className="analytics-recent-metrics">

                  <span>
                    🌙 {item.sleep}h
                  </span>

                  <span>
                    🚶 {item.steps.toLocaleString()}
                  </span>

                  <span>
                    💧 {item.water}
                  </span>

                  <span>
                    📱 {item.screenTime}h
                  </span>

                </div>


                <strong className="analytics-recent-score">
                  {item.score}
                </strong>

              </div>
            ))}

        </div>

      </section>

    </div>
  );
}
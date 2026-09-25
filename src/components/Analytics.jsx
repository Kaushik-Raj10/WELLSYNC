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
  AreaChart,
  Area,
} from "recharts";

import { getCloudCheckins } from "../utils/supabaseData";
import { getWellnessHistory } from "../utils/wellnessData";
import { calculateWellnessScore } from "../utils/wellnessScore";
import "./Analytics.css";

function normalize(item) {
  if (!item) return null;

  return {
    date: item.date || "",
    sleep: Number(item.sleep ?? 0),
    water: Number(item.water ?? 0),
    steps: Number(item.steps ?? 0),
    screenTime: Number(item.screenTime ?? item.screen_time ?? 0),
    mood: item.mood || "Okay",
    energy: Number(item.energy ?? 5),
    stress: Number(item.stress ?? 5),
  };
}

function formatDate(date, options = { day: "numeric", month: "short" }) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(date);

  return parsed.toLocaleDateString("en-IN", options);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function getTrend(values) {
  if (values.length < 2) return "stable";

  const midpoint = Math.floor(values.length / 2);
  const first = average(values.slice(0, midpoint));
  const second = average(values.slice(midpoint));

  if (second - first >= 3) return "up";
  if (second - first <= -3) return "down";
  return "stable";
}

function getTrendText(trend) {
  if (trend === "up") return "Improving";
  if (trend === "down") return "Needs attention";
  return "Holding steady";
}

function getMetricConfig(metric) {
  return {
    score: {
      label: "Wellness score",
      unit: "/100",
      colorClass: "purple",
      accessor: (item) => calculateWellnessScore(item),
      formatter: (value) => `${Math.round(value)}`,
    },
    sleep: {
      label: "Sleep",
      unit: "h",
      colorClass: "blue",
      accessor: (item) => item.sleep,
      formatter: (value) => `${round(value)}h`,
    },
    energy: {
      label: "Energy",
      unit: "/10",
      colorClass: "amber",
      accessor: (item) => item.energy,
      formatter: (value) => `${round(value)}/10`,
    },
    stress: {
      label: "Stress",
      unit: "/10",
      colorClass: "pink",
      accessor: (item) => item.stress,
      formatter: (value) => `${round(value)}/10`,
    },
    steps: {
      label: "Steps",
      unit: "",
      colorClass: "green",
      accessor: (item) => item.steps,
      formatter: (value) => Math.round(value).toLocaleString(),
    },
  }[metric];
}

function pushToAI(prompt, mode = "data_analyst") {
  try {
    sessionStorage.setItem("wellsync_ai_prompt", prompt);
    sessionStorage.setItem("wellsync_ai_mode", mode);
  } catch {
    // Best-effort handoff only.
  }
}

export default function Analytics({ onNavigate }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("local");
  const [period, setPeriod] = useState(7);
  const [metric, setMetric] = useState("score");

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      setLoading(true);
      let data = [];
      let cloudWorked = false;

      try {
        const cloud = await getCloudCheckins();

        if (Array.isArray(cloud)) {
          data = cloud;
          cloudWorked = cloud.length > 0;
        }
      } catch (error) {
        console.warn("Analytics cloud data unavailable:", error);
      }

      if (!data.length) {
        try {
          data = getWellnessHistory();
        } catch (error) {
          console.warn("Analytics local history unavailable:", error);
          data = [];
        }
      }

      const normalized = data
        .map(normalize)
        .filter(Boolean)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

      if (!mounted) return;

      setHistory(normalized);
      setSource(cloudWorked ? "cloud" : "local");
      setLoading(false);
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, []);

  const scoredHistory = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        score: calculateWellnessScore(item),
      })),
    [history]
  );

  const current = scoredHistory[scoredHistory.length - 1] || null;
  const currentScore = current?.score ?? 0;

  const periodData = useMemo(
    () => scoredHistory.slice(-period),
    [scoredHistory, period]
  );

  const averageScore = useMemo(
    () =>
      scoredHistory.length
        ? Math.round(average(scoredHistory.map((item) => item.score)))
        : 0,
    [scoredHistory]
  );

  const bestDay = useMemo(
    () =>
      scoredHistory.length
        ? scoredHistory.reduce((best, item) =>
            item.score > best.score ? item : best
          )
        : null,
    [scoredHistory]
  );

  const lowestDay = useMemo(
    () =>
      scoredHistory.length
        ? scoredHistory.reduce((lowest, item) =>
            item.score < lowest.score ? item : lowest
          )
        : null,
    [scoredHistory]
  );

  const trend = useMemo(
    () => getTrend(periodData.map((item) => item.score)),
    [periodData]
  );

  const metricConfig = getMetricConfig(metric);

  const trendChartData = useMemo(
    () =>
      periodData.map((item) => ({
        date: formatDate(item.date),
        value: metricConfig.accessor(item),
        rawScore: item.score,
      })),
    [periodData, metricConfig]
  );

  const habitAverages = useMemo(() => {
    if (!history.length) return null;

    return {
      sleep: round(average(history.map((item) => item.sleep))),
      water: round(average(history.map((item) => item.water))),
      steps: Math.round(average(history.map((item) => item.steps))),
      screenTime: round(average(history.map((item) => item.screenTime))),
      energy: round(average(history.map((item) => item.energy))),
      stress: round(average(history.map((item) => item.stress))),
    };
  }, [history]);

  const habitChartData = habitAverages
    ? [
        { label: "Sleep", value: habitAverages.sleep },
        { label: "Water", value: habitAverages.water },
        { label: "Energy", value: habitAverages.energy },
        { label: "Stress", value: habitAverages.stress },
      ]
    : [];

  const rangeChange = useMemo(() => {
    if (periodData.length < 2) return 0;
    return Math.round(
      (periodData[periodData.length - 1].score - periodData[0].score) * 10
    ) / 10;
  }, [periodData]);

  const metricDomain = useMemo(() => {
    if (!trendChartData.length) return [0, 100];

    if (metric === "score") return [0, 100];

    const values = trendChartData.map((item) => item.value);
    const max = Math.max(...values);
    const min = Math.min(...values);

    if (metric === "steps") {
      return [0, Math.max(1000, Math.ceil((max * 1.15) / 500) * 500)];
    }

    return [
      Math.max(0, Math.floor((min - 1) * 2) / 2),
      Math.ceil((max + 1) * 2) / 2,
    ];
  }, [trendChartData, metric]);

  const askAboutChart = () => {
    pushToAI(
      `Analyze my ${metricConfig.label.toLowerCase()} trend over the last ${period} tracked days. ` +
        `Explain the meaningful changes visible in my history, mention uncertainty when the sample is small, and give one or two practical next steps.`,
      "data_analyst"
    );
    onNavigate?.("ai");
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner" />
        <p>Building your wellness analytics...</p>
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="analytics-page">
        <header className="analytics-hero">
          <div>
            <span className="analytics-kicker">WELLNESS DATA INTELLIGENCE</span>
            <h1>See your <em>progress.</em></h1>
            <p>Keep checking in and WELLsync will turn your history into meaningful trends.</p>
          </div>
        </header>

        <section className="analytics-empty-shell">
          <div className="analytics-empty-icon">⌁</div>
          <div>
            <span className="analytics-kicker">BUILD YOUR BASELINE</span>
            <h2>Your analytics are waiting for data.</h2>
            <p>Complete more Daily Check-Ins to create a useful personal history.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <header className="analytics-hero">
        <div>
          <span className="analytics-kicker">WELLNESS DATA INTELLIGENCE</span>
          <h1>See your <em>progress.</em></h1>
          <p>Explore trends, averages, and changes across the signals you track.</p>
        </div>

        <div className="analytics-hero-actions">
          <div className="analytics-source-pill">
            <span />
            {source === "cloud" ? "Synced with Supabase" : "Saved locally"}
          </div>
          <button type="button" className="analytics-ai-button" onClick={askAboutChart}>
            ✦ Ask AI about this data
          </button>
        </div>
      </header>

      <section className="analytics-summary-grid">
        <article className="analytics-summary-card primary">
          <span className="analytics-label">CURRENT SCORE</span>
          <strong>{currentScore}<small>/100</small></strong>
          <p>Latest wellness signal</p>
        </article>

        <article className="analytics-summary-card">
          <span className="analytics-label">AVERAGE</span>
          <strong>{averageScore}</strong>
          <p>Across {history.length} tracked day{history.length === 1 ? "" : "s"}</p>
        </article>

        <article className="analytics-summary-card">
          <span className="analytics-label">BEST DAY</span>
          <strong>{bestDay?.score ?? "—"}</strong>
          <p>{bestDay ? formatDate(bestDay.date) : "—"}</p>
        </article>

        <article className="analytics-summary-card">
          <span className="analytics-label">RECENT CHANGE</span>
          <strong>{rangeChange > 0 ? "↗" : rangeChange < 0 ? "↘" : "→"}</strong>
          <p>{getTrendText(trend)}</p>
        </article>
      </section>

      <section className="analytics-main-card">
        <div className="analytics-card-top">
          <div>
            <span className="analytics-label">TREND EXPLORER</span>
            <h2>Choose a signal. See the pattern.</h2>
          </div>

          <div className="analytics-period-controls">
            {[7, 14, 30].map((value) => (
              <button
                type="button"
                key={value}
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value}D
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-metric-switcher">
          {Object.entries({
            score: "Wellness",
            sleep: "Sleep",
            energy: "Energy",
            stress: "Stress",
            steps: "Steps",
          }).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={metric === id ? "active" : ""}
              onClick={() => setMetric(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="analytics-chart-head">
          <div>
            <strong>{metricConfig.label}</strong>
            <span>Last {Math.min(period, history.length)} tracked day{Math.min(period, history.length) === 1 ? "" : "s"}</span>
          </div>
          <button type="button" onClick={askAboutChart}>
            Ask AI →
          </button>
        </div>

        <div className="analytics-large-chart">
          {trendChartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <defs>
                  <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#907eff" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#907eff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#748196", fontSize: 10 }}
                />
                <YAxis
                  domain={metricDomain}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#748196", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#101925",
                    border: "1px solid rgba(255,255,255,.1)",
                    borderRadius: 14,
                    color: "#f2f4f8",
                  }}
                  formatter={(value) => [
                    metricConfig.formatter(value),
                    metricConfig.label,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#9b89ff"
                  strokeWidth={2.7}
                  fill="url(#analyticsArea)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics-chart-placeholder">
              <span>⌁</span>
              <p>Keep checking in to unlock a fuller personal trend.</p>
            </div>
          )}
        </div>
      </section>

      {habitAverages && (
        <section className="analytics-two-up">
          <article className="analytics-panel">
            <div className="analytics-card-top">
              <div>
                <span className="analytics-label">TYPICAL DAY</span>
                <h2>Your history at a glance</h2>
              </div>
            </div>

            <div className="analytics-habit-list">
              <div><span>◐ Sleep</span><strong>{habitAverages.sleep}h</strong></div>
              <div><span>◇ Water</span><strong>{habitAverages.water} glasses</strong></div>
              <div><span>↗ Steps</span><strong>{habitAverages.steps.toLocaleString()}</strong></div>
              <div><span>□ Screen</span><strong>{habitAverages.screenTime}h</strong></div>
              <div><span>✦ Energy</span><strong>{habitAverages.energy}/10</strong></div>
              <div><span>∿ Stress</span><strong>{habitAverages.stress}/10</strong></div>
            </div>
          </article>

          <article className="analytics-panel">
            <div className="analytics-card-top">
              <div>
                <span className="analytics-label">AVERAGE SIGNALS</span>
                <h2>How the dimensions compare</h2>
              </div>
            </div>

            <div className="analytics-bar-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={habitChartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#748196", fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#748196", fontSize: 9 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,.025)" }}
                    contentStyle={{
                      background: "#101925",
                      border: "1px solid rgba(255,255,255,.1)",
                      borderRadius: 14,
                      color: "#f2f4f8",
                    }}
                  />
                  <Bar dataKey="value" fill="#8f7cff" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      )}

      <section className="analytics-insight-strip">
        <div className="analytics-insight-icon">✦</div>
        <div>
          <span className="analytics-label">DATA INTERPRETATION</span>
          <h2>
            {trend === "up"
              ? "Your recent wellness signal is moving upward."
              : trend === "down"
                ? "Your recent wellness signal has room to reset."
                : "Your recent wellness signal is relatively steady."}
          </h2>
          <p>
            Use the trend as context, not a verdict. A small sample can be noisy, so continued tracking helps WELLsync separate one unusual day from a repeated pattern.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            pushToAI(
              "Review my recent WELLsync analytics as a data analyst. Summarize the key trend, strongest signal, and one practical experiment I could try next.",
              "data_analyst"
            );
            onNavigate?.("ai");
          }}
        >
          Get AI interpretation →
        </button>
      </section>

      <section className="analytics-recent-card">
        <div className="analytics-card-top">
          <div>
            <span className="analytics-label">RECENT PERFORMANCE</span>
            <h2>Your latest check-ins</h2>
          </div>
          <span className="analytics-period-note">{Math.min(7, history.length)} recent</span>
        </div>

        <div className="analytics-recent-list">
          {scoredHistory
            .slice()
            .reverse()
            .slice(0, 7)
            .map((item) => (
              <div className="analytics-recent-row" key={`${item.date}-${item.score}`}>
                <div className="analytics-recent-date">
                  <strong>{formatDate(item.date)}</strong>
                  <span>{item.mood}</span>
                </div>

                <div className="analytics-recent-metrics">
                  <span>◐ {item.sleep}h</span>
                  <span>◇ {item.water}</span>
                  <span>↗ {item.steps.toLocaleString()}</span>
                  <span>□ {item.screenTime}h</span>
                </div>

                <strong className="analytics-recent-score">{item.score}</strong>
              </div>
            ))}
        </div>
      </section>

      {lowestDay && (
        <section className="analytics-reference-grid">
          <article>
            <span className="analytics-label">STRONGEST REFERENCE DAY</span>
            <h3>{bestDay?.score ?? "—"}/100 · {bestDay ? formatDate(bestDay.date) : "—"}</h3>
            <p>Use a stronger day as a reference point for understanding which habits tend to coexist in your routine.</p>
          </article>
          <article>
            <span className="analytics-label">LOWER REFERENCE DAY</span>
            <h3>{lowestDay.score}/100 · {formatDate(lowestDay.date)}</h3>
            <p>A lower signal is another comparison point. It does not by itself indicate failure; it adds context to your history.</p>
          </article>
        </section>
      )}
    </div>
  );
}

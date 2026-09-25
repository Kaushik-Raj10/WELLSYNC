import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
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
import "./Insights.css";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;

  return {
    date: item.date || "",
    sleep: toNumber(item.sleep),
    water: toNumber(item.water),
    steps: toNumber(item.steps),
    screenTime: toNumber(item.screenTime ?? item.screen_time),
    mood: item.mood || "Okay",
    energy: toNumber(item.energy, 5),
    stress: toNumber(item.stress, 5),
  };
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeItem).filter(Boolean);
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

function getScoreLabel(score) {
  if (score >= 85) return "Strong rhythm";
  if (score >= 70) return "Good momentum";
  if (score >= 50) return "Room to improve";
  return "Reset opportunity";
}

function getBreakdown(data) {
  if (!data) return [];

  const moodMap = {
    Great: 100,
    Good: 85,
    Okay: 65,
    Low: 40,
    Stressed: 25,
  };

  return [
    {
      label: "Sleep",
      icon: "◐",
      value: Math.round(Math.min(data.sleep / 8, 1) * 100),
      weight: "20%",
      helper: `${data.sleep}h logged`,
      tone: "purple",
    },
    {
      label: "Hydration",
      icon: "◇",
      value: Math.round(Math.min(data.water / 8, 1) * 100),
      weight: "15%",
      helper: `${data.water} glasses`,
      tone: "cyan",
    },
    {
      label: "Activity",
      icon: "↗",
      value: Math.round(Math.min(data.steps / 8000, 1) * 100),
      weight: "20%",
      helper: `${data.steps.toLocaleString()} steps`,
      tone: "green",
    },
    {
      label: "Screen balance",
      icon: "□",
      value: Math.round(
        data.screenTime <= 4
          ? 100
          : Math.max(0, 100 - (data.screenTime - 4) * 15)
      ),
      weight: "10%",
      helper: `${data.screenTime}h screen time`,
      tone: "orange",
    },
    {
      label: "Mood",
      icon: "◉",
      value: moodMap[data.mood] ?? 65,
      weight: "15%",
      helper: `${data.mood} today`,
      tone: "pink",
    },
    {
      label: "Energy",
      icon: "✦",
      value: Math.round((data.energy / 10) * 100),
      weight: "10%",
      helper: `${data.energy}/10`,
      tone: "amber",
    },
    {
      label: "Stress balance",
      icon: "∿",
      value: Math.round(((10 - data.stress) / 9) * 100),
      weight: "10%",
      helper: `${data.stress}/10 stress`,
      tone: "blue",
    },
  ];
}

function getSignals(data) {
  if (!data) return { strengths: [], focus: [] };

  const signals = [
    {
      name: "Sleep",
      icon: "◐",
      score: Math.min(data.sleep / 8, 1) * 100,
      message:
        data.sleep >= 7
          ? "Your current sleep signal is supporting your routine."
          : "Sleep is one of the clearer areas to work on.",
      tone: "purple",
    },
    {
      name: "Hydration",
      icon: "◇",
      score: Math.min(data.water / 8, 1) * 100,
      message:
        data.water >= 6
          ? "Your hydration is in a solid range."
          : "Your hydration is currently below the default target.",
      tone: "cyan",
    },
    {
      name: "Activity",
      icon: "↗",
      score: Math.min(data.steps / 8000, 1) * 100,
      message:
        data.steps >= 6000
          ? "Your movement level is supporting the day."
          : "Additional movement could strengthen the routine.",
      tone: "green",
    },
    {
      name: "Screen balance",
      icon: "□",
      score:
        data.screenTime <= 4
          ? 100
          : Math.max(0, 100 - (data.screenTime - 4) * 15),
      message:
        data.screenTime <= 6
          ? "Your current screen-time signal is manageable."
          : "Screen time is one area worth watching.",
      tone: "orange",
    },
    {
      name: "Energy",
      icon: "✦",
      score: (data.energy / 10) * 100,
      message:
        data.energy >= 7
          ? "Your energy signal is currently strong."
          : "Your energy signal has room for improvement.",
      tone: "amber",
    },
    {
      name: "Stress balance",
      icon: "∿",
      score: ((10 - data.stress) / 9) * 100,
      message:
        data.stress <= 5
          ? "Your stress signal is relatively controlled."
          : "Stress is currently worth paying attention to.",
      tone: "blue",
    },
  ];

  return {
    strengths: [...signals].sort((a, b) => b.score - a.score).slice(0, 2),
    focus: [...signals].sort((a, b) => a.score - b.score).slice(0, 2),
  };
}

function getPatterns(history) {
  if (history.length < 3) {
    return [
      {
        icon: "⌁",
        title: "Your pattern baseline is still forming",
        text:
          "Keep checking in consistently. WELLsync needs several observations before repeated relationships become meaningful.",
      },
    ];
  }

  const patterns = [];

  const sleepStress = history.filter(
    (item) => item.sleep < 7 && item.stress >= 6
  ).length;

  if (sleepStress >= Math.ceil(history.length * 0.5)) {
    patterns.push({
      icon: "◐",
      title: "Shorter sleep often overlaps with higher stress",
      text:
        "Several tracked days combine shorter sleep with higher stress signals. Treat this as an observed overlap, not proof that one causes the other.",
    });
  }

  const screenSleep = history.filter(
    (item) => item.screenTime > 6 && item.sleep < 7
  ).length;

  if (screenSleep >= Math.ceil(history.length * 0.5)) {
    patterns.push({
      icon: "□",
      title: "Higher screen-time days often overlap with shorter sleep",
      text:
        "Your tracked history shows repeated overlap between these signals. More tracking can help show whether the relationship persists.",
    });
  }

  const activityEnergy = history.filter(
    (item) => item.steps >= 6000 && item.energy >= 7
  ).length;

  if (activityEnergy >= Math.ceil(history.length * 0.5)) {
    patterns.push({
      icon: "↗",
      title: "Movement and energy often appear together",
      text:
        "Several tracked days combine 6,000+ steps with stronger energy signals.",
    });
  }

  const hydrationEnergy = history.filter(
    (item) => item.water >= 6 && item.energy >= 7
  ).length;

  if (hydrationEnergy >= Math.ceil(history.length * 0.5)) {
    patterns.push({
      icon: "◇",
      title: "Higher hydration days often align with stronger energy",
      text:
        "Your history shows repeated days where higher hydration and stronger energy appear together.",
    });
  }

  return patterns.length
    ? patterns.slice(0, 3)
    : [
        {
          icon: "⌁",
          title: "Your personal pattern is still emerging",
          text:
            "WELLsync has not found a strong repeated relationship yet. Keep tracking consistently.",
        },
      ];
}

function pushToAI(prompt, mode = "data_analyst") {
  try {
    sessionStorage.setItem("wellsync_ai_prompt", prompt);
    sessionStorage.setItem("wellsync_ai_mode", mode);
  } catch {
    // Best-effort handoff only.
  }
}

export default function Insights({ onNavigate }) {
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("local");
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        let cloudHistory = [];
        let cloudLatest = null;

        try {
          const result = await getCloudCheckins();
          if (Array.isArray(result)) cloudHistory = result;
        } catch (cloudError) {
          console.warn("Insights cloud history unavailable:", cloudError);
        }

        try {
          cloudLatest = await getLatestCloudCheckin();
        } catch (cloudError) {
          console.warn("Insights latest cloud record unavailable:", cloudError);
        }

        let finalHistory = normalizeArray(cloudHistory);

        if (!finalHistory.length) {
          try {
            finalHistory = normalizeArray(getWellnessHistory());
          } catch (localError) {
            console.warn("Insights local history unavailable:", localError);
          }
        }

        let finalLatest = normalizeItem(cloudLatest);

        if (!finalLatest) {
          try {
            finalLatest = normalizeItem(getWellnessData());
          } catch (localError) {
            console.warn("Insights local current data unavailable:", localError);
          }
        }

        finalHistory.sort(
          (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
        );

        if (!mounted) return;

        setHistory(finalHistory);
        setLatest(finalLatest);
        setSource(cloudHistory.length ? "cloud" : "local");
      } catch (loadError) {
        console.error("Insights failed to load:", loadError);
        if (mounted) setError("WELLsync could not load your insights right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const score = latest ? calculateWellnessScore(latest) : 0;
  const breakdown = useMemo(() => getBreakdown(latest), [latest]);
  const signals = useMemo(() => getSignals(latest), [latest]);
  const patterns = useMemo(() => getPatterns(history), [history]);

  const chartData = useMemo(
    () =>
      history.slice(-period).map((item) => ({
        date: formatDate(item.date),
        score: calculateWellnessScore(item),
      })),
    [history, period]
  );

  const averageScore = useMemo(
    () =>
      history.length
        ? Math.round(
            average(history.map((item) => calculateWellnessScore(item)))
          )
        : 0,
    [history]
  );

  const change = useMemo(() => {
    if (chartData.length < 2) return 0;
    return Math.round(
      (chartData[chartData.length - 1].score - chartData[0].score) * 10
    ) / 10;
  }, [chartData]);

  const askAboutPattern = (pattern) => {
    pushToAI(
      `Analyze this WELLsync pattern more deeply: "${pattern.title}". ` +
        `Use my recent wellness history to explain what the data supports, what it does not prove, and what practical habit experiment I could try next.`,
      "data_analyst"
    );
    onNavigate?.("ai");
  };

  const askAboutFocus = (focus) => {
    pushToAI(
      `Look at my wellness data and help me understand why ${focus.name} may currently be one of my focus areas. Give practical next steps based on my tracked context.`,
      "general"
    );
    onNavigate?.("ai");
  };

  if (loading) {
    return (
      <div className="insights-loading">
        <div className="loading-spinner" />
        <p>Building your personal insights...</p>
      </div>
    );
  }

  if (error && !latest) {
    return (
      <div className="insights-page">
        <div className="insights-empty-shell">
          <div className="insights-empty-icon">!</div>
          <div>
            <span className="insights-kicker">PERSONAL WELLNESS INTELLIGENCE</span>
            <h1>We couldn't load your insights.</h1>
            <p>Refresh the page and try again. Your existing wellness data has not been changed.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="insights-page">
        <header className="insights-hero minimal">
          <div>
            <span className="insights-kicker">PERSONAL WELLNESS INTELLIGENCE</span>
            <h1>Understand your <em>patterns.</em></h1>
            <p>Complete your first Daily Check-In and WELLsync will start turning your signals into useful personal context.</p>
          </div>
        </header>

        <section className="insights-empty-shell">
          <div className="insights-empty-icon">✦</div>
          <div>
            <span className="insights-kicker">WELLSYNC START</span>
            <h2>Your first insight is one check-in away.</h2>
            <p>Your score, patterns, strengths, and trends will appear here once WELLsync has a current signal to work with.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <header className="insights-hero">
        <div>
          <span className="insights-kicker">PERSONAL WELLNESS INTELLIGENCE</span>
          <h1>Understand your <em>patterns.</em></h1>
          <p>
            WELLsync turns your daily signals into understandable patterns,
            context, and practical next steps.
          </p>
        </div>

        <div className="insights-hero-actions">
          <div className="insights-source-pill">
            <span />
            {source === "cloud" ? "Synced with Supabase" : "Saved locally"}
          </div>
          <button
            type="button"
            className="insights-ai-button"
            onClick={() => {
              pushToAI(
                "Give me a concise interpretation of my current wellness signal, my recent trend, and the top area I should focus on today.",
                "data_analyst"
              );
              onNavigate?.("ai");
            }}
          >
            ✦ Ask AI to interpret
          </button>
        </div>
      </header>

      <section className="insights-command-grid">
        <article className="insights-score-panel">
          <div className="insights-score-orbit" style={{ "--score": score }}>
            <div className="insights-score-inner">
              <span>TODAY</span>
              <strong>{score}</strong>
              <small>/100</small>
            </div>
          </div>
          <div className="insights-score-copy">
            <span className="insights-label">CURRENT WELLNESS SIGNAL</span>
            <h2>{getScoreLabel(score)}</h2>
            <p>
              Your composite signal is based on the wellness factors you track in WELLsync.
            </p>
            <div className="insights-mini-stats">
              <span><strong>{history.length}</strong> days tracked</span>
              <span><strong>{averageScore}</strong> average</span>
            </div>
          </div>
        </article>

        <article className="insights-trend-panel">
          <div className="insights-card-head">
            <div>
              <span className="insights-label">RECENT TREND</span>
              <h2>How your signal is moving</h2>
            </div>
            <div className={`insights-change ${change > 0 ? "up" : change < 0 ? "down" : "stable"}`}>
              {change > 0 ? "↗" : change < 0 ? "↘" : "→"} {Math.abs(change)}
            </div>
          </div>

          <div className="insights-period-row">
            {[7, 14, 30].map((value) => (
              <button
                key={value}
                type="button"
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value}D
              </button>
            ))}
          </div>

          <div className="insights-trend-chart">
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="insightsAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8d7cff" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#8d7cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#718096", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#718096", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#101925",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      color: "#eef2f7",
                    }}
                    formatter={(value) => [`${value}/100`, "Wellness"]}
                  />
                  <Area type="monotone" dataKey="score" stroke="#9a8cff" strokeWidth={2.5} fill="url(#insightsAreaFill)" />
                  <Line type="monotone" dataKey="score" stroke="#b2a7ff" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="insights-chart-placeholder">
                <span>⌁</span>
                <p>Track at least two days to reveal a personal trend.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="insights-section">
        <div className="insights-section-head">
          <div>
            <span className="insights-label">SCORE ARCHITECTURE</span>
            <h2>What is driving today's signal?</h2>
          </div>
          <span className="insights-section-note">Transparent prototype heuristic</span>
        </div>

        <div className="insights-breakdown-grid">
          {breakdown.map((item) => (
            <article className={`insights-breakdown-card ${item.tone}`} key={item.label}>
              <div className="insights-breakdown-top">
                <span className="insights-breakdown-icon">{item.icon}</span>
                <span>{item.label}</span>
                <small>{item.weight}</small>
              </div>
              <div className="insights-breakdown-value">
                {item.value}<small>/100</small>
              </div>
              <div className="insights-meter">
                <span style={{ width: `${item.value}%` }} />
              </div>
              <p>{item.helper}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="insights-two-up">
        <article className="insights-panel">
          <div className="insights-section-head compact">
            <div>
              <span className="insights-label">YOUR STRENGTHS</span>
              <h2>What's working</h2>
            </div>
          </div>

          <div className="insights-signal-list">
            {signals.strengths.map((item) => (
              <div className={`insights-signal-row ${item.tone}`} key={item.name}>
                <span className="insights-signal-icon">{item.icon}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.message}</p>
                </div>
                <b>{Math.round(item.score)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="insights-panel">
          <div className="insights-section-head compact">
            <div>
              <span className="insights-label">NEXT OPPORTUNITIES</span>
              <h2>Where to look next</h2>
            </div>
          </div>

          <div className="insights-signal-list">
            {signals.focus.map((item) => (
              <button
                type="button"
                className={`insights-signal-row button-row ${item.tone}`}
                key={item.name}
                onClick={() => askAboutFocus(item)}
              >
                <span className="insights-signal-icon">{item.icon}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.message}</p>
                </div>
                <b>↗</b>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="insights-pattern-shell">
        <div className="insights-pattern-head">
          <div>
            <span className="insights-label">PERSONAL PATTERN DETECTION</span>
            <h2>What WELLsync is noticing</h2>
            <p>These are observations from your tracked history, not medical conclusions.</p>
          </div>
          <span className="insights-ai-badge">✦ AI-READY CONTEXT</span>
        </div>

        <div className="insights-pattern-grid">
          {patterns.map((pattern, index) => (
            <article className="insights-pattern-card" key={`${pattern.title}-${index}`}>
              <div className="insights-pattern-icon">{pattern.icon}</div>
              <div className="insights-pattern-copy">
                <h3>{pattern.title}</h3>
                <p>{pattern.text}</p>
                <button type="button" onClick={() => askAboutPattern(pattern)}>
                  Ask AI about this pattern <span>→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="insights-takeaway">
        <div className="insights-takeaway-icon">✦</div>
        <div>
          <span className="insights-label">WELLSYNC TAKEAWAY</span>
          <h2>Your data should lead to a useful next step.</h2>
          <p>
            {signals.focus.length
              ? `${signals.focus[0].name} is currently one of the clearer areas to explore. Start with a small change and use future check-ins to see whether the signal shifts.`
              : "Your current signals are relatively balanced. Keep tracking consistently so WELLsync can distinguish an unusual day from a repeated pattern."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            pushToAI(
              "Turn my current WELLsync insights into a practical plan for today. Keep it realistic and focused on one or two habits.",
              "general"
            );
            onNavigate?.("ai");
          }}
        >
          Build an AI action plan →
        </button>
      </section>
    </div>
  );
}

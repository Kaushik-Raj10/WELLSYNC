import { useEffect, useMemo, useState } from "react";
import { calculateWellnessScore } from "../utils/wellnessScore";
import {
  getWellnessHistory,
  getGoals as getLocalGoals,
} from "../utils/wellnessData";
import {
  getCloudCheckins,
  getCloudGoals,
} from "../utils/supabaseData";
import { supabase } from "../lib/supabase";
import "./Dashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getTimeTheme() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getGreeting(theme) {
  if (theme === "morning") return "Good morning";
  if (theme === "day") return "Good afternoon";
  if (theme === "evening") return "Good evening";
  return "Good night";
}

const SKY_STARS = Array.from({ length: 42 }, (_, index) => ({
  left: `${(index * 37) % 97}%`,
  top: `${(index * 53) % 56}%`,
  size: `${1.4 + (index % 3) * 0.7}px`,
  delay: `${-(index % 11) * 1.35}s`,
  duration: `${5 + (index % 6)}s`,
}));

function getTimeSubtitle(theme) {
  const subtitles = {
    morning: "Start the day with a calm, useful rhythm.",
    day: "Keep your momentum simple and sustainable.",
    evening: "Use the evening to protect tomorrow's energy.",
    night: "Wind down, recover and give your day a clean finish.",
  };

  return subtitles[theme];
}

function formatDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

function getMoodMeta(mood) {
  const moodMap = {
    Great: { glyph: "✦", tone: "positive" },
    Good: { glyph: "◒", tone: "calm" },
    Okay: { glyph: "◌", tone: "neutral" },
    Low: { glyph: "⌁", tone: "soft" },
    Stressed: { glyph: "≈", tone: "alert" },
  };

  return moodMap[mood] || moodMap.Good;
}

function normalizeGoals(data) {
  return {
    sleep: Number(data?.sleep ?? 7),
    water: Number(data?.water ?? 6),
    steps: Number(data?.steps ?? 6000),
    screenTime: Number(data?.screenTime ?? data?.screen_time ?? 6),
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

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function getPriority(data, goals) {
  if (!data) {
    return {
      title: "Complete your first check-in",
      description:
        "Share how you slept, moved, hydrated and felt today to unlock your personalized dashboard.",
      label: "GET STARTED",
      icon: "✦",
      tone: "violet",
      action: "checkin",
    };
  }

  const candidates = [
    {
      active: data.sleep < goals.sleep,
      title: "Protect your sleep consistency",
      description: `You logged ${data.sleep.toFixed(1)}h against a ${goals.sleep.toFixed(1)}h target. A calmer evening routine is a practical place to start.`,
      label: "SLEEP",
      icon: "◒",
      tone: "indigo",
      action: "ai",
    },
    {
      active: data.water < goals.water,
      title: "Close the hydration gap",
      description: `You are at ${data.water} glasses against a ${goals.water}-glass target. Keep the next increase small and easy to repeat.`,
      label: "HYDRATION",
      icon: "◇",
      tone: "cyan",
      action: "checkin",
    },
    {
      active: data.steps < goals.steps,
      title: "Add a little more movement",
      description: `You are at ${data.steps.toLocaleString("en-IN")} steps against ${goals.steps.toLocaleString("en-IN")}. A short walk can move the signal without changing your whole day.`,
      label: "MOVEMENT",
      icon: "↗",
      tone: "green",
      action: "ai",
    },
    {
      active: data.screenTime > goals.screenTime,
      title: "Create a screen-free window",
      description: `Your screen time is ${data.screenTime.toFixed(1)}h against a ${goals.screenTime.toFixed(1)}h target. One protected break can create useful separation.`,
      label: "SCREEN BALANCE",
      icon: "▣",
      tone: "orange",
      action: "ai",
    },
    {
      active: data.stress > 6,
      title: "Build a recovery window",
      description:
        "Your stress signal is elevated today. A short pause, walk or breathing reset can create some breathing room.",
      label: "RECOVERY",
      icon: "≈",
      tone: "rose",
      action: "ai",
    },
  ];

  return (
    candidates.find((item) => item.active) || {
      title: "Protect the rhythm you already have",
      description:
        "Your current signals are relatively balanced. Consistency is the most useful next step.",
      label: "BALANCED DAY",
      icon: "✓",
      tone: "green",
      action: "ai",
    }
  );
}

function buildLocalBrief(data, goals) {
  const priority = getPriority(data, goals);

  return {
    headline: priority.title,
    body: priority.description,
    focus: priority.label === "GET STARTED" ? "First check-in" : priority.label,
    why: priority.description,
    actions: [
      "Keep the next step small and realistic.",
      "Use your current goal as the anchor for today.",
      "Let the next check-in tell you whether the signal is shifting.",
    ],
  };
}

function parseAiBrief(text, data, goals) {
  const fallback = buildLocalBrief(data, goals);

  if (!text?.trim()) return fallback;

  const cleaned = text
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const extractNumberedPart = (number, nextNumber) => {
    const currentPattern = new RegExp(
      `\\(?${number}\\)?\\s*`,
      "i"
    );
    const match = cleaned.match(currentPattern);

    if (!match) return "";

    const startIndex = match.index + match[0].length;
    let endIndex = cleaned.length;

    if (nextNumber) {
      const nextPattern = new RegExp(
        `\\(?${nextNumber}\\)?\\s*`,
        "i"
      );
      const nextMatch = cleaned
        .slice(startIndex)
        .match(nextPattern);

      if (nextMatch) {
        endIndex = startIndex + nextMatch.index;
      }
    }

    return cleaned
      .slice(startIndex, endIndex)
      .replace(
        /^(?:what is happening today|why it matters(?: in context)?|three realistic actions(?: for today)?)\s*:?\s*/i,
        ""
      )
      .replace(/^\s*[:\-]\s*/, "")
      .trim();
  };

  let headline = extractNumberedPart(1, 2);
  let why = extractNumberedPart(2, 3);
  let actionText = extractNumberedPart(3, null);

  // Support unnumbered headings and compact single-line responses.
  const headings = [
    {
      key: "headline",
      pattern: /what is happening today\s*:?\s*/i,
    },
    {
      key: "why",
      pattern: /why it matters(?: in context)?\s*:?\s*/i,
    },
    {
      key: "actions",
      pattern: /three realistic actions(?: for today)?\s*:?\s*/i,
    },
  ]
    .map((item) => {
      const match = cleaned.match(item.pattern);
      return match
        ? {
            ...item,
            index: match.index,
            end: match.index + match[0].length,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  if (headings.length >= 2) {
    headline = cleaned
      .slice(headings[0].end, headings[1].index)
      .replace(/^\s*[:\-]\s*/, "")
      .trim();

    if (headings[2]) {
      why = cleaned
        .slice(headings[1].end, headings[2].index)
        .replace(/^\s*[:\-]\s*/, "")
        .trim();

      actionText = cleaned
        .slice(headings[2].end)
        .replace(/^\s*[:\-]\s*/, "")
        .trim();
    } else {
      why = cleaned
        .slice(headings[1].end)
        .replace(/^\s*[:\-]\s*/, "")
        .trim();
    }
  }

  headline = headline
    .replace(/^\s*\(?1\)?\s*/i, "")
    .trim();

  why = why
    .replace(/^\s*\(?2\)?\s*/i, "")
    .trim();

  const parsedActions = actionText
    .replace(/^\s*\(?3\)?\s*/i, "")
    .split(/\s*(?:\d+[.)]\s+|[-•]\s+)/)
    .map((item) => item.trim())
    .filter((item) => item.length > 5)
    .slice(0, 3);

  return {
    headline: headline || fallback.headline,
    body: why || fallback.body,
    focus: fallback.focus,
    why: why || fallback.why,
    actions: parsedActions.length ? parsedActions : fallback.actions,
  };
}

async function fetchAiBrief({ data, goals, history }) {
  const requestBody = {
    message:
      "Create a concise AI wellness brief for my dashboard. Use my current wellness data, goals and recent history. Return exactly three short parts in plain text: (1) what is happening today, (2) why it matters in context, (3) three realistic actions for today. Keep it practical, non-medical, and do not restate every number.",
    wellness_data: data,
    goals,
    history: history.slice(-7),
    device_data: {},
    profile: {},
    mode: "general",
    web_mode: "personal_data",
    conversation: [],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.detail || `AI brief request failed (${response.status})`);
    }

    return result?.response || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function Icon({ name, size = 18, stroke = 1.8 }) {
  const paths = {
    spark: (
      <>
        <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
      </>
    ),
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    moon: <path d="M20 14.2A7.7 7.7 0 0 1 9.8 4 7.8 7.8 0 1 0 20 14.2Z" />,
    water: <path d="M12 3s5.2 5.6 5.2 9.2A5.2 5.2 0 0 1 6.8 12.2C6.8 8.6 12 3 12 3Z" />,
    steps: (
      <>
        <path d="M8.5 14.5c1.7 1.2 3.2 3.1 2.5 5.2-.7 2.1-3.6 2.1-5.1.5-1.4-1.6-.7-4.2 2.6-5.7Z" />
        <path d="M15.5 9.5c-1.7-1.2-3.2-3.1-2.5-5.2.7-2.1 3.6-2.1 5.1-.5 1.4 1.6.7 4.2-2.6 5.7Z" />
      </>
    ),
    screen: (
      <>
        <rect x="4" y="3" width="16" height="14" rx="2" />
        <path d="M9 21h6M12 17v4" />
      </>
    ),
    energy: <path d="m13 2-8 11h6l-1 9 8-11h-6l1-9Z" />,
    stress: (
      <>
        <path d="M4 13c2-5 4.2 5 6.3 0 2-5 4.2 5 6.3 0 1.1-2.7 2.1-.7 3.4.6" />
        <path d="M5 19h14" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
        <path d="M7 3v4M17 3v4M3.5 9.5h17" />
      </>
    ),
    trend: (
      <>
        <path d="M4 17V7" />
        <path d="m7 14 4-4 3 3 6-7" />
        <path d="M17 6h3v3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m9 6 9 6-9 6V6Z" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function MetricCard({ icon, label, value, unit, progress, target, helper, tone }) {
  return (
    <article className={`dash-metric dash-metric-${tone}`}>
      <div className="dash-metric-top">
        <div className="dash-metric-icon"><Icon name={icon} size={17} /></div>
        <span>{label}</span>
        <i />
      </div>

      <div className="dash-metric-value">
        <strong>{value}</strong>
        {unit && <small>{unit}</small>}
      </div>

      <div className="dash-metric-meta">
        <span>{helper}</span>
        <b>{target}</b>
      </div>

      <div className="dash-metric-track">
        <span style={{ width: `${clamp(progress)}%` }} />
      </div>
    </article>
  );
}

function GoalMini({ icon, label, current, goal, inverse = false, unit = "" }) {
  const safeGoal = Math.max(Number(goal) || 1, 0.1);
  const value = Number(current) || 0;
  const percent = inverse
    ? clamp((safeGoal / Math.max(value, safeGoal)) * 100)
    : clamp((value / safeGoal) * 100);

  const complete = inverse ? value <= safeGoal : value >= safeGoal;

  return (
    <button type="button" className="dash-goal-mini" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
      <div
        className="dash-goal-ring"
        style={{
          background: `conic-gradient(#8c79ff ${percent * 3.6}deg, rgba(255,255,255,.07) ${percent * 3.6}deg)`,
        }}
      >
        <div>{complete ? <Icon name="check" size={13} /> : `${Math.round(percent)}%`}</div>
      </div>
      <div className="dash-goal-copy">
        <span>{label}</span>
        <strong>{value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}{unit}</strong>
        <small>Goal {Number(goal).toLocaleString("en-IN", { maximumFractionDigits: 1 })}{unit}</small>
      </div>
    </button>
  );
}

function MultiTrendChart({ history, goals }) {
  const rows = history.slice(-7);

  if (rows.length < 2) {
    return (
      <div className="dash-trend-empty">
        <div className="dash-trend-empty-icon"><Icon name="trend" size={20} /></div>
        <div>
          <strong>Weekly progress will appear here.</strong>
          <span>Keep checking in to reveal how your signals move across the week.</span>
        </div>
      </div>
    );
  }

  const width = 760;
  const height = 205;
  const padX = 18;
  const padY = 23;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padY * 2;
  const xStep = chartWidth / Math.max(rows.length - 1, 1);

  const series = [
    {
      key: "steps",
      label: "Activity",
      color: "#57dfc3",
      values: rows.map((row) => clamp((row.steps / Math.max(goals.steps, 1)) * 100)),
    },
    {
      key: "sleep",
      label: "Sleep",
      color: "#a38fff",
      values: rows.map((row) => clamp((row.sleep / Math.max(goals.sleep, 1)) * 100)),
    },
    {
      key: "water",
      label: "Hydration",
      color: "#62b8ff",
      values: rows.map((row) => clamp((row.water / Math.max(goals.water, 1)) * 100)),
    },
    {
      key: "energy",
      label: "Energy",
      color: "#ffbf76",
      values: rows.map((row) => clamp(row.energy * 10)),
    },
  ];

  function pointPath(values) {
    return values
      .map((value, index) => {
        const x = padX + index * xStep;
        const y = height - padY - (value / 100) * chartHeight;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  return (
    <div className="dash-week-chart-wrap">
      <div className="dash-chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="dash-week-chart" preserveAspectRatio="none">
        {[20, 50, 80].map((level) => {
          const y = height - padY - (level / 100) * chartHeight;
          return <line key={level} x1="0" y1={y} x2={width} y2={y} className="dash-grid-line" />;
        })}

        {series.map((item) => (
          <path
            key={item.key}
            d={pointPath(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".92"
          />
        ))}

        {series.map((item) =>
          item.values.map((value, index) => {
            const x = padX + index * xStep;
            const y = height - padY - (value / 100) * chartHeight;
            return <circle key={`${item.key}-${index}`} cx={x} cy={y} r="2.6" fill={item.color} />;
          })
        )}
      </svg>

      <div className="dash-week-labels">
        {rows.map((row) => (
          <span key={row.date}>
            {new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
              new Date(`${row.date}T12:00:00`)
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({
  latestData,
  onNavigate,
  dataSource = "local",
}) {
  const [userName, setUserName] = useState("there");
  const [goals, setGoals] = useState(() => normalizeGoals(getLocalGoals()));
  const [history, setHistory] = useState(() =>
    normalizeHistory(getWellnessHistory())
  );
  const [timeTheme, setTimeTheme] = useState(getTimeTheme());
  const [aiBrief, setAiBrief] = useState(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const current = normalizeWellness(latestData);
  const score = current ? Math.round(calculateWellnessScore(current)) : 0;
  const moodMeta = getMoodMeta(current?.mood);
  const priority = getPriority(current, goals);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeTheme(getTimeTheme());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      if (!supabase) return;

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.warn("Dashboard user lookup failed:", error);
        return;
      }

      const fullName = data?.user?.user_metadata?.full_name;

      if (mounted && fullName?.trim()) {
        setUserName(fullName.trim().split(/\s+/)[0]);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      const localHistory = normalizeHistory(getWellnessHistory());

      if (mounted && localHistory.length) {
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
        }

        const normalizedCloudHistory = normalizeHistory(cloudHistory);

        if (normalizedCloudHistory.length) {
          setHistory(normalizedCloudHistory);
        }
      } catch (error) {
        console.info("Dashboard using local context:", error?.message || error);
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!current) return;

    const cacheKey = `wellsync_dashboard_brief_${new Date().toISOString().slice(0, 10)}_${score}_${JSON.stringify(goals)}`;

    try {
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        setAiBrief(JSON.parse(cached));
        return;
      }
    } catch {
      // Continue with live generation.
    }

    let mounted = true;

    async function generateBrief() {
      setAiBriefLoading(true);

      try {
        const aiText = await fetchAiBrief({
          data: current,
          goals,
          history,
        });

        if (!mounted) return;

        const parsed = parseAiBrief(aiText, current, goals);
        setAiBrief(parsed);

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
        } catch {
          // Cache is optional.
        }
      } catch (error) {
        console.info("AI brief unavailable, using local brief:", error?.message || error);

        if (mounted) {
          setAiBrief(buildLocalBrief(current, goals));
        }
      } finally {
        if (mounted) {
          setAiBriefLoading(false);
        }
      }
    }

    generateBrief();

    return () => {
      mounted = false;
    };
  }, [score, JSON.stringify(goals), current?.sleep, current?.water, current?.steps, current?.screenTime, current?.mood, current?.energy, current?.stress, history.length]);

  const trendDelta = useMemo(() => {
    const rows = history.slice(-2);

    if (rows.length < 2) return null;

    const previous = Math.round(calculateWellnessScore(rows[0]));
    const latest = Math.round(calculateWellnessScore(rows[1]));

    return latest - previous;
  }, [history]);

  const todayPlan = useMemo(() => {
    if (!current) {
      return {
        focus: "First check-in",
        icon: "✦",
        actions: [
          "Complete your daily check-in.",
          "Set one realistic target.",
          "Let WELLsync establish your baseline.",
        ],
      };
    }

    const actionsByArea = {
      sleep: [
        "Protect a consistent wind-down window tonight.",
        "Reduce late stimulation before bed.",
        "Review your sleep signal tomorrow.",
      ],
      hydration: [
        "Keep water visible during the next few hours.",
        "Add one practical hydration checkpoint.",
        "Log the next change in your routine.",
      ],
      activity: [
        "Take a short walk or movement break.",
        "Use the next natural transition to add steps.",
        "Check whether the gap is shrinking later today.",
      ],
      screen: [
        "Create one protected screen-free block.",
        "Move your phone away during that block.",
        "Notice how the break changes your evening rhythm.",
      ],
      stress: [
        "Take a brief reset away from the screen.",
        "Try a slow breathing or walking break.",
        "Return to the next task with one clear priority.",
      ],
      consistency: [
        "Keep today's routine simple.",
        "Protect the habits already working.",
        "Use your next check-in to review the signal.",
      ],
    };

    const key =
      priority.label === "SLEEP"
        ? "sleep"
        : priority.label === "HYDRATION"
          ? "hydration"
          : priority.label === "MOVEMENT"
            ? "activity"
            : priority.label === "SCREEN BALANCE"
              ? "screen"
              : priority.label === "RECOVERY"
                ? "stress"
                : "consistency";

    return {
      focus: priority.title,
      icon: priority.icon,
      actions: actionsByArea[key],
    };
  }, [current?.sleep, current?.water, current?.steps, current?.screenTime, current?.stress, priority.label, priority.title, priority.icon]);

  function openAi(prompt, mode = "general", webMode = "auto") {
    try {
      sessionStorage.setItem("wellsync_ai_prompt", prompt);
      sessionStorage.setItem("wellsync_ai_mode", mode);
      sessionStorage.setItem("wellsync_ai_web_mode", webMode);
    } catch {
      // Best-effort handoff.
    }

    onNavigate?.("ai");
  }

  function handleSearch(event) {
    event.preventDefault();

    const clean = searchText.trim();
    if (!clean) return;

    openAi(clean, "general", "auto");
    setSearchText("");
  }

  const displayBrief = aiBrief || buildLocalBrief(current, goals);

  return (
    <div className={`dashboard-page-redesigned dash-time-${timeTheme}`}>
      <div className="dash-background-scene" aria-hidden="true">
        <div className="dash-scene-photo dash-scene-photo-morning" />
        <div className="dash-scene-photo dash-scene-photo-day" />
        <div className="dash-scene-photo dash-scene-photo-evening" />
        <div className="dash-scene-photo dash-scene-photo-night" />
        <div className="dash-scene-gradient" />
        <div className="dash-scene-cloud dash-scene-cloud-one" />
        <div className="dash-scene-cloud dash-scene-cloud-two" />
        <div className="dash-scene-cloud dash-scene-cloud-three" />
        <div className="dash-scene-sun" />
        <div className="dash-scene-moon" />
        <div className="dash-scene-horizon" />
        <div className="dash-scene-stars">
          {SKY_STARS.map((star, index) => (
            <span
              key={index}
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
                animationDuration: star.duration,
              }}
            />
          ))}
        </div>
        <div className="dash-scene-particles" />
      </div>

      <header className="dash-command-bar">
        <form className="dash-search" onSubmit={handleSearch}>
          <Icon name="search" size={18} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Ask anything about your wellness, workouts, nutrition..."
            aria-label="Ask WELLsync"
          />
          <button type="submit" aria-label="Ask WELLsync">
            <Icon name="arrow" size={16} />
          </button>
        </form>

        <div className="dash-command-meta">
          <div className="dash-date-pill">
            <Icon name="calendar" size={14} />
            {formatDate()}
          </div>

          <div className="dash-profile-pill">
            <div className="dash-profile-avatar">{userName?.charAt(0)?.toUpperCase() || "U"}</div>
            <div>
              <strong>Hi, {userName}</strong>
              <span>{getTimeSubtitle(timeTheme)}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="dash-welcome-row">
        <div>
          <div className="dash-kicker">
            <span />
            PERSONAL WELLNESS COMMAND CENTER
          </div>
          <h1>{getGreeting(timeTheme)}, <b>{userName}</b> <span className="dash-wave">👋</span></h1>
          <p>{getTimeSubtitle(timeTheme)}</p>
        </div>

        <div className="dash-time-badge">
          <span>{timeTheme === "morning" ? "DAWN" : timeTheme === "day" ? "DAYLIGHT" : timeTheme === "evening" ? "SUNSET" : "NIGHT"}</span>
          <strong>{score || "—"}</strong>
          <small>signal</small>
        </div>
      </section>

      {!current ? (
        <section className="dash-empty-command glass-panel">
          <div className="dash-empty-orb"><Icon name="spark" size={28} /></div>
          <div>
            <div className="section-eyebrow">WELLSYNC START</div>
            <h2>Your command center starts with one daily check-in.</h2>
            <p>Capture a few everyday signals and WELLsync will turn them into a clearer picture of your routine.</p>
            <button className="dash-primary-button" type="button" onClick={() => onNavigate?.("checkin")}>
              Complete check-in <Icon name="arrow" size={16} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="dash-main-grid"><div className="dash-left-stack">
          <section className="dash-overview-card glass-panel">
            <div className="dash-overview-heading">
              <div>
                <div className="section-eyebrow">TODAY'S OVERVIEW</div>
                <h2>Your wellness at a glance.</h2>
              </div>
              <span className={`dash-cloud-state ${dataSource === "cloud" ? "cloud" : "local"}`}>
                <i /> {dataSource === "cloud" ? "Synced" : "Local"}
              </span>
            </div>

            <div className="dash-overview-grid">
              <div className="dash-score-feature">
                <div className="dash-score-ring" style={{ "--dash-score-deg": `${score * 3.6}deg` }}>
                  <div>
                    <span>WELLNESS</span>
                    <strong>{score}</strong>
                    <small>/100</small>
                  </div>
                </div>

                <div className="dash-score-copy">
                  <span>Composite lifestyle signal</span>
                  <strong>{score >= 85 ? "Strong rhythm" : score >= 70 ? "Good momentum" : score >= 50 ? "Room to improve" : "Reset opportunity"}</strong>
                  {trendDelta !== null && (
                    <em className={trendDelta >= 0 ? "up" : "down"}>
                      {trendDelta >= 0 ? "↑" : "↓"} {Math.abs(trendDelta)} from the previous check-in
                    </em>
                  )}
                </div>
              </div>

              <div className="dash-overview-metrics">
                <MetricCard
                  icon="steps"
                  label="Steps"
                  value={current.steps.toLocaleString("en-IN")}
                  progress={(current.steps / Math.max(goals.steps, 1)) * 100}
                  target={`${Math.round((current.steps / Math.max(goals.steps, 1)) * 100)}% of goal`}
                  helper="Movement"
                  tone="green"
                />
                <MetricCard
                  icon="moon"
                  label="Sleep"
                  value={current.sleep.toFixed(1)}
                  unit="h"
                  progress={(current.sleep / Math.max(goals.sleep, 1)) * 100}
                  target={`Goal ${goals.sleep.toFixed(1)}h`}
                  helper="Recovery"
                  tone="violet"
                />
                <MetricCard
                  icon="water"
                  label="Water"
                  value={current.water}
                  unit=" glasses"
                  progress={(current.water / Math.max(goals.water, 1)) * 100}
                  target={`Goal ${goals.water}`}
                  helper="Hydration"
                  tone="cyan"
                />
                <MetricCard
                  icon="screen"
                  label="Screen"
                  value={current.screenTime.toFixed(1)}
                  unit="h"
                  progress={100 - Math.max(current.screenTime - goals.screenTime, 0) * 15}
                  target={`Target ≤ ${goals.screenTime.toFixed(1)}h`}
                  helper="Digital balance"
                  tone="orange"
                />
                <MetricCard
                  icon="energy"
                  label="Energy"
                  value={current.energy}
                  unit="/10"
                  progress={current.energy * 10}
                  target="Scale 0–10"
                  helper="Capacity"
                  tone="pink"
                />
              </div>
            </div>
          </section>
              <article className="dash-ai-brief glass-panel">
                <div className="dash-card-head">
                  <div>
                    <div className="dash-ai-chip"><Icon name="spark" size={13} /> AI WELLNESS BRIEF</div>
                    <h2>{displayBrief.headline}</h2>
                  </div>
                  <span className="dash-ai-online"><i /> Gemini</span>
                </div>

                <p className="dash-ai-brief-body">
                  {aiBriefLoading ? "WELLsync AI is synthesizing your latest context…" : displayBrief.body}
                </p>

                <div className="dash-brief-grid">
                  <div className="dash-brief-tile focus">
                    <span>FOCUS</span>
                    <strong>{displayBrief.focus}</strong>
                    <small>One useful priority for today.</small>
                  </div>
                  <div className="dash-brief-tile why">
                    <span>WHY?</span>
                    <strong>Context matters</strong>
                    <small>{displayBrief.why}</small>
                  </div>
                  <div className="dash-brief-tile action">
                    <span>DO THIS TODAY</span>
                    <ol>
                      {displayBrief.actions.map((action, index) => (
                        <li key={`${action}-${index}`}>{action}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="dash-brief-actions">
                  <button className="dash-primary-button" type="button" onClick={() => openAi("Review my current wellness data and turn today's AI brief into a practical plan for the rest of the day.", "general", "auto")}>
                    Ask WELLsync AI <Icon name="arrow" size={15} />
                  </button>
                  <button className="dash-secondary-button" type="button" onClick={() => onNavigate?.("insights")}>
                    Explore insights
                  </button>
                </div>
              </article>

              <article className="dash-week-card glass-panel">
                <div className="dash-card-head">
                  <div>
                    <div className="section-eyebrow">WEEKLY PROGRESS</div>
                    <h2>Your personal rhythm</h2>
                  </div>
                  <button type="button" className="dash-chart-toggle" onClick={() => onNavigate?.("analytics")}>View analytics <Icon name="arrow" size={14} /></button>
                </div>

                <MultiTrendChart history={history} goals={goals} />

                <div className="dash-week-summary">
                  <div><span>Latest</span><strong>{score}</strong></div>
                  <div><span>Sleep</span><strong>{current.sleep.toFixed(1)}h</strong></div>
                  <div><span>Hydration</span><strong>{current.water} / {goals.water}</strong></div>
                  <div><span>Movement</span><strong>{current.steps.toLocaleString("en-IN")}</strong></div>
                </div>
              </article>

              <article className="dash-recommendations glass-panel">
                <div className="dash-card-head">
                  <div>
                    <div className="section-eyebrow">AI RECOMMENDATIONS</div>
                    <h2>Useful next moves</h2>
                  </div>
                  <button className="dash-chart-toggle" type="button" onClick={() => openAi("Give me one useful recommendation for today based on my current wellness context.", "general", "auto")}>View all <Icon name="arrow" size={14} /></button>
                </div>

                <div className="dash-recommendation-grid">
                  <button type="button" className="dash-recommendation-card workout" onClick={() => openAi("Create a sustainable 15-minute full-body workout that fits my current wellness context.", "trainer", "auto")}>
                    <div><Icon name="play" size={18} /></div>
                    <span>FITNESS</span>
                    <strong>Workout plan</strong>
                    <small>AI-generated · 15 min</small>
                    <b>Start now <Icon name="arrow" size={14} /></b>
                  </button>

                  <button type="button" className="dash-recommendation-card nutrition" onClick={() => openAi("Give me balanced meal ideas for today based on my current wellness context.", "nutrition", "auto")}>
                    <div><Icon name="water" size={18} /></div>
                    <span>NUTRITION</span>
                    <strong>Meal ideas</strong>
                    <small>Personalized to today's context</small>
                    <b>View plan <Icon name="arrow" size={14} /></b>
                  </button>

                  <button type="button" className="dash-recommendation-card sleep" onClick={() => openAi("Help me improve tonight's sleep routine based on my current wellness context.", "recovery", "auto")}>
                    <div><Icon name="moon" size={18} /></div>
                    <span>RECOVERY</span>
                    <strong>Sleep reset</strong>
                    <small>Build a calmer evening</small>
                    <b>Get tips <Icon name="arrow" size={14} /></b>
                  </button>

                  <button type="button" className="dash-recommendation-card mindfulness" onClick={() => openAi("Give me a simple 5-minute mindfulness or breathing reset I can do today.", "recovery", "auto")}>
                    <div><Icon name="spark" size={18} /></div>
                    <span>RESET</span>
                    <strong>Mindfulness</strong>
                    <small>5-minute breathing session</small>
                    <b>Start session <Icon name="arrow" size={14} /></b>
                  </button>
                </div>
              </article>
            </div>

            <aside className="dash-right-stack">
              <article className="dash-coach-card glass-panel">
                <div className="dash-coach-head">
                  <div>
                    <div className="section-eyebrow">YOUR AI COACH</div>
                    <h2>WELLsync AI</h2>
                  </div>
                  <span><i /> Online</span>
                </div>

                <div className="dash-coach-orb">
                  <div className="dash-coach-star s1">✦</div>
                  <div className="dash-coach-star s2">✦</div>
                  <div className="dash-coach-star s3">✦</div>
                  <div className="dash-coach-face">⌣</div>
                </div>

                <h3>Your personal intelligence layer.</h3>
                <p>
                  Ask about your routine, workouts, nutrition, recovery, goals or current wellness context.
                </p>

                <div className="dash-coach-mode-grid">
                  <button type="button" onClick={() => openAi("What should I focus on today?", "general", "auto")}>General Chat<small>Ask anything</small></button>
                  <button type="button" onClick={() => openAi("Create a practical workout for today.", "trainer", "auto")}>Fitness Coach<small>Workout plans</small></button>
                  <button type="button" onClick={() => openAi("What balanced meals could I have today?", "nutrition", "auto")}>Nutrition Coach<small>Meal ideas</small></button>
                  <button type="button" onClick={() => openAi("Help me build a better recovery routine tonight.", "recovery", "auto")}>Recovery Coach<small>Sleep & reset</small></button>
                  <button type="button" onClick={() => openAi("Analyze my recent wellness patterns.", "data_analyst", "personal_data")}>Analyze My Data<small>Trends & patterns</small></button>
                  <button type="button" onClick={() => openAi("Review my goals and build a realistic 7-day plan.", "goals", "auto")}>Goal Coach<small>Help me improve</small></button>
                </div>

                <button type="button" className="dash-coach-ask" onClick={() => openAi("Give me a concise overview of what matters most in my wellness today.", "general", "auto")}>
                  <span><Icon name="search" size={15} /></span>
                  <strong>Ask me anything...</strong>
                  <b><Icon name="arrow" size={15} /></b>
                </button>
              </article>

              <article className="dash-quick-card glass-panel">
                <div className="dash-card-head">
                  <div>
                    <div className="section-eyebrow">QUICK ACTIONS</div>
                    <h2>Move without friction.</h2>
                  </div>
                  <button type="button" className="dash-chart-toggle" onClick={() => onNavigate?.("insights")}>Customize <Icon name="arrow" size={14} /></button>
                </div>

                <div className="dash-quick-grid">
                  <button type="button" onClick={() => onNavigate?.("checkin")}><Icon name="calendar" size={20} /><span>Daily Check-In</span></button>
                  <button type="button" onClick={() => onNavigate?.("goals")}><Icon name="trend" size={20} /><span>Set Goals</span></button>
                  <button type="button" onClick={() => onNavigate?.("insights")}><Icon name="spark" size={20} /><span>View Insights</span></button>
                  <button type="button" onClick={() => onNavigate?.("analytics")}><Icon name="trend" size={20} /><span>Analytics</span></button>
                </div>
              </article>

              <article className="dash-goals-card glass-panel">
                <div className="dash-card-head">
                  <div>
                    <div className="section-eyebrow">TODAY'S GOALS</div>
                    <h2>Progress at a glance</h2>
                  </div>
                  <button type="button" className="dash-chart-toggle" onClick={() => onNavigate?.("goals")}>Edit goals <Icon name="arrow" size={14} /></button>
                </div>

                <div className="dash-goal-list">
                  <GoalMini icon="steps" label="Steps" current={current.steps} goal={goals.steps} />
                  <GoalMini icon="moon" label="Sleep" current={current.sleep} goal={goals.sleep} unit="h" />
                  <GoalMini icon="water" label="Water" current={current.water} goal={goals.water} />
                  <GoalMini icon="screen" label="Screen" current={current.screenTime} goal={goals.screenTime} unit="h" inverse />
                </div>
              </article>

              <article className="dash-feeling-card glass-panel">
                <div className="dash-card-head">
                  <div>
                    <div className="section-eyebrow">INNER STATE</div>
                    <h2>How you feel</h2>
                  </div>
                  <div className={`dash-mood-orb ${moodMeta.tone}`}>{moodMeta.glyph}</div>
                </div>

                <div className="dash-feeling-main">
                  <div>
                    <strong>{current.mood}</strong>
                    <span>Current mood signal</span>
                  </div>
                  <button type="button" onClick={() => openAi("Help me understand my current mood and energy context without overinterpreting it.", "general", "personal_data")}>Talk to AI</button>
                </div>

                <div className="dash-feeling-bars">
                  <div>
                    <span>Energy</span>
                    <b>{current.energy}/10</b>
                    <i><span style={{ width: `${current.energy * 10}%` }} /></i>
                  </div>
                  <div>
                    <span>Stress balance</span>
                    <b>{current.stress}/10</b>
                    <i><span style={{ width: `${Math.max(0, 100 - current.stress * 10)}%` }} /></i>
                  </div>
                </div>
              </article>
            </aside>
          </section>

          <section className="dash-loop-card glass-panel">
            <div>
              <div className="section-eyebrow">THE WELLSYNC LOOP</div>
              <h2>Track → Analyze → Understand → Act.</h2>
              <p>Collect everyday signals, connect the context, and turn the next decision into something useful.</p>
            </div>

            <div className="dash-loop-steps">
              {[
                ["01", "Track"],
                ["02", "Analyze"],
                ["03", "Understand"],
                ["04", "Act"],
              ].map(([number, label], index) => (
                <div className="dash-loop-step" key={label}>
                  <span>{number}</span>
                  <strong>{label}</strong>
                  {index < 3 && <i>→</i>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

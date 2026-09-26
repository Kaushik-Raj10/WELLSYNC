import { useEffect, useMemo, useState } from "react";
import { calculateWellnessScore } from "../utils/wellnessScore";
import { getWellnessHistory, getGoals as getLocalGoals } from "../utils/wellnessData";
import { getCloudCheckins, getCloudGoals } from "../utils/supabaseData";
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
  return {
    morning: "Good morning",
    day: "Good afternoon",
    evening: "Good evening",
    night: "Good night",
  }[theme];
}

function getSubtitle(theme) {
  return {
    morning: "Start the day with a calm, useful rhythm.",
    day: "Keep your momentum simple and sustainable.",
    evening: "Use the evening to protect tomorrow's energy.",
    night: "Wind down, recover and give your day a clean finish.",
  }[theme];
}

function formatDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

function normalizeGoals(data) {
  return {
    sleep: Number(data?.sleep ?? 7),
    water: Number(data?.water ?? 6),
    steps: Number(data?.steps ?? 6000),
    screenTime: Number(data?.screenTime ?? data?.screen_time ?? 6),
  };
}

function normalizeData(data) {
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
    .map((row) => ({
      date: row.date,
      sleep: Number(row.sleep ?? 0),
      water: Number(row.water ?? 0),
      steps: Number(row.steps ?? 0),
      screenTime: Number(row.screenTime ?? row.screen_time ?? 0),
      mood: row.mood ?? "Okay",
      energy: Number(row.energy ?? 5),
      stress: Number(row.stress ?? 5),
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function Icon({ name, size = 18, stroke = 1.8 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.2" /><path d="M7 3v4M17 3v4M3.5 9.5h17" /></>,
    spark: <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    steps: <><path d="M8.5 14.5c1.7 1.2 3.2 3.1 2.5 5.2-.7 2.1-3.6 2.1-5.1.5-1.4-1.6-.7-4.2 2.6-5.7Z" /><path d="M15.5 9.5c-1.7-1.2-3.2-3.1-2.5-5.2.7-2.1 3.6-2.1 5.1-.5 1.4 1.6.7 4.2-2.6 5.7Z" /></>,
    moon: <path d="M20 14.2A7.7 7.7 0 0 1 9.8 4 7.8 7.8 0 1 0 20 14.2Z" />,
    water: <path d="M12 3s5.2 5.6 5.2 9.2A5.2 5.2 0 0 1 6.8 12.2C6.8 8.6 12 3 12 3Z" />,
    screen: <><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M9 21h6M12 17v4" /></>,
    energy: <path d="m13 2-8 11h6l-1 9 8-11h-6l1-9Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    trend: <><path d="M4 17V7" /><path d="m7 14 4-4 3 3 6-7" /><path d="M17 6h3v3" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function getPriority(data, goals) {
  if (!data) return { label: "GET STARTED", title: "Complete your first check-in", description: "Capture a few everyday signals and WELLsync will build your personal baseline." };
  if (data.sleep < goals.sleep) return { label: "SLEEP", title: "Protect your recovery tonight", description: `You logged ${data.sleep.toFixed(1)}h against a ${goals.sleep.toFixed(1)}h target. A calmer evening is a useful place to start.` };
  if (data.water < goals.water) return { label: "HYDRATION", title: "Close the hydration gap", description: `You are at ${data.water} glasses against a ${goals.water}-glass target. Keep the next increase practical and easy to repeat.` };
  if (data.steps < goals.steps) return { label: "MOVEMENT", title: "Add a little more movement", description: `You are at ${data.steps.toLocaleString("en-IN")} steps against ${goals.steps.toLocaleString("en-IN")}. A short walk can close part of the gap.` };
  if (data.screenTime > goals.screenTime) return { label: "SCREEN BALANCE", title: "Create a screen-free window", description: `Your screen time is ${data.screenTime.toFixed(1)}h against a ${goals.screenTime.toFixed(1)}h target. One protected break can create useful separation.` };
  if (data.stress > 6) return { label: "RECOVERY", title: "Build a recovery window", description: "Your stress signal is elevated today. A short pause, walk or breathing reset can create some breathing room." };
  return { label: "BALANCED DAY", title: "Protect the rhythm you already have", description: "Your current signals are relatively balanced. Consistency is the most useful next step." };
}

function buildLocalBrief(data, goals) {
  const priority = getPriority(data, goals);
  return {
    headline: priority.title,
    body: priority.description,
    focus: priority.label,
    actions: [
      "Keep the next step small and realistic.",
      "Use your current goal as the anchor for today.",
      "Let the next check-in tell you whether the signal is shifting.",
    ],
  };
}

function parseBrief(text, data, goals) {
  const fallback = buildLocalBrief(data, goals);
  if (!text?.trim()) return fallback;

  const cleaned = text.replace(/\r/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s*\(?[1-3]\)?[.:\-]\s*/).filter(Boolean);

  if (parts.length >= 3) {
    const headline = parts[0].replace(/^what is happening today\s*:?\s*/i, "").trim();
    const why = parts[1].replace(/^why it matters(?: in context)?\s*:?\s*/i, "").trim();
    const actions = parts[2]
      .split(/(?:\d+[.)]|[-•])\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 5)
      .slice(0, 3);

    return {
      headline: headline || fallback.headline,
      body: why || fallback.body,
      focus: fallback.focus,
      actions: actions.length ? actions : fallback.actions,
    };
  }

  return { ...fallback, headline: cleaned.slice(0, 180) };
}

async function fetchAiBrief(data, goals, history) {
  const body = {
    message: "Create a concise AI wellness brief for my dashboard. Return exactly three short numbered parts in plain text: (1) what is happening today, (2) why it matters in context, (3) three realistic actions for today. Keep it practical, non-medical, and do not restate every number.",
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
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.detail || `AI brief failed (${response.status})`);
    return result?.response || result?.message || "";
  } finally {
    window.clearTimeout(timeout);
  }
}

function MetricCard({ icon, label, value, unit, progress, helper, target, tone }) {
  return (
    <article className={`dash2-metric dash2-${tone}`}>
      <div className="dash2-metric-top">
        <span className="dash2-metric-icon"><Icon name={icon} size={17} /></span>
        <span className="dash2-metric-label">{label}</span>
      </div>
      <div className="dash2-metric-value"><strong>{value}</strong>{unit && <small>{unit}</small>}</div>
      <div className="dash2-metric-meta"><span>{helper}</span><b>{target}</b></div>
      <div className="dash2-track"><span style={{ width: `${clamp(progress)}%` }} /></div>
    </article>
  );
}

function GoalItem({ icon, label, current, goal, unit = "", inverse = false }) {
  const value = Number(current) || 0;
  const target = Math.max(Number(goal) || 1, 0.1);
  const percent = inverse ? clamp((target / Math.max(value, target)) * 100) : clamp((value / target) * 100);
  const complete = inverse ? value <= target : value >= target;

  return (
    <div className="dash2-goal-item">
      <div className="dash2-goal-icon"><Icon name={icon} size={16} /></div>
      <div className="dash2-goal-copy">
        <div><span>{label}</span><strong>{value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}{unit}</strong></div>
        <small>Goal {target.toLocaleString("en-IN", { maximumFractionDigits: 1 })}{unit}</small>
        <div className="dash2-goal-track"><span style={{ width: `${percent}%` }} /></div>
      </div>
      <div className={`dash2-goal-percent ${complete ? "complete" : ""}`}>{complete ? <Icon name="check" size={13} /> : `${Math.round(percent)}%`}</div>
    </div>
  );
}

export default function Dashboard({ latestData, onNavigate, dataSource = "local" }) {
  const [userName, setUserName] = useState("there");
  const [goals, setGoals] = useState(() => normalizeGoals(getLocalGoals()));
  const [history, setHistory] = useState(() => normalizeHistory(getWellnessHistory()));
  const [timeTheme, setTimeTheme] = useState(getTimeTheme());
  const [aiBrief, setAiBrief] = useState(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const current = normalizeData(latestData);
  const score = current ? Math.round(calculateWellnessScore(current)) : 0;
  const priority = getPriority(current, goals);
  const brief = aiBrief || buildLocalBrief(current, goals);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeTheme(getTimeTheme()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      if (!supabase) return;
      const { data, error } = await supabase.auth.getUser();
      if (error) return;
      const fullName = data?.user?.user_metadata?.full_name;
      if (mounted && fullName?.trim()) setUserName(fullName.trim().split(/\s+/)[0]);
    }
    loadUser();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadContext() {
      const localHistory = normalizeHistory(getWellnessHistory());
      if (mounted && localHistory.length) setHistory(localHistory);
      try {
        const [cloudGoals, cloudHistory] = await Promise.all([getCloudGoals(), getCloudCheckins()]);
        if (!mounted) return;
        if (cloudGoals) setGoals(normalizeGoals(cloudGoals));
        const normalized = normalizeHistory(cloudHistory);
        if (normalized.length) setHistory(normalized);
      } catch (error) {
        console.info("Dashboard using local context:", error?.message || error);
      }
    }
    loadContext();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!current) return;
    let mounted = true;
    async function generate() {
      setAiBriefLoading(true);
      try {
        const key = `wellsync_dashboard_brief_v2_${new Date().toISOString().slice(0, 10)}_${score}_${JSON.stringify(goals)}`;
        const cached = sessionStorage.getItem(key);
        if (cached) {
          setAiBrief(JSON.parse(cached));
          setAiBriefLoading(false);
          return;
        }
        const response = await fetchAiBrief(current, goals, history);
        if (!mounted) return;
        const parsed = parseBrief(response, current, goals);
        setAiBrief(parsed);
        sessionStorage.setItem(key, JSON.stringify(parsed));
      } catch (error) {
        console.info("AI brief unavailable:", error?.message || error);
        if (mounted) setAiBrief(buildLocalBrief(current, goals));
      } finally {
        if (mounted) setAiBriefLoading(false);
      }
    }
    generate();
    return () => { mounted = false; };
  }, [score, JSON.stringify(goals), current?.sleep, current?.water, current?.steps, current?.screenTime, current?.mood, current?.energy, current?.stress, history.length]);

  const trendDelta = useMemo(() => {
    const rows = history.slice(-2);
    if (rows.length < 2) return null;
    return Math.round(calculateWellnessScore(rows[1])) - Math.round(calculateWellnessScore(rows[0]));
  }, [history]);

  function openAi(prompt, mode = "general") {
    try {
      sessionStorage.setItem("wellsync_ai_prompt", prompt);
      sessionStorage.setItem("wellsync_ai_mode", mode);
      sessionStorage.setItem("wellsync_ai_web_mode", "auto");
    } catch {}
    onNavigate?.("ai");
  }

  function handleSearch(event) {
    event.preventDefault();
    const clean = searchText.trim();
    if (!clean) return;
    openAi(clean, "general");
    setSearchText("");
  }

  if (!current) {
    return (
      <div className={`dashboard-page-redesigned dash2-page dash2-time-${timeTheme}`}>
        <BackgroundScene theme={timeTheme} />
        <div className="dash2-empty glass-panel">
          <div className="dash2-empty-icon"><Icon name="spark" size={28} /></div>
          <div><div className="dash2-eyebrow">WELLSYNC START</div><h2>Start with your first daily check-in.</h2><p>Capture a few everyday signals and WELLsync will turn them into a clearer picture of your routine.</p><button className="dash2-primary" onClick={() => onNavigate?.("checkin")}>Complete check-in <Icon name="arrow" size={15} /></button></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-page-redesigned dash2-page dash2-time-${timeTheme}`}>
      <BackgroundScene theme={timeTheme} />

      <header className="dash2-command">
        <form className="dash2-search" onSubmit={handleSearch}>
          <Icon name="search" size={18} />
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Ask anything about your wellness..." aria-label="Ask WELLsync" />
          <button type="submit" aria-label="Ask WELLsync"><Icon name="arrow" size={16} /></button>
        </form>
        <div className="dash2-command-right">
          <div className="dash2-date"><Icon name="calendar" size={15} /> {formatDate()}</div>
          <div className="dash2-profile"><span>{userName.charAt(0).toUpperCase() || "U"}</span><div><strong>Hi, {userName}</strong><small>{getSubtitle(timeTheme)}</small></div></div>
        </div>
      </header>

      <section className="dash2-welcome">
        <div>
          <div className="dash2-eyebrow"><i /> PERSONAL WELLNESS COMMAND CENTER</div>
          <h1>{getGreeting(timeTheme)}, <span>{userName}</span> <b>👋</b></h1>
          <p>{getSubtitle(timeTheme)}</p>
        </div>
        <div className="dash2-signal"><span>{timeTheme === "morning" ? "MORNING" : timeTheme === "day" ? "DAYLIGHT" : timeTheme === "evening" ? "EVENING" : "NIGHT"}</span><strong>{score}</strong><small>signal</small></div>
      </section>

      <main className="dash2-main">
        <div className="dash2-left">
          <section className="dash2-overview glass-panel">
            <div className="dash2-section-head dash2-overview-head">
              <div>
                <div className="dash2-eyebrow">TODAY'S OVERVIEW</div>
                <h2>Your wellness at a glance.</h2>
              </div>

              <div className="dash2-overview-status">
                <span className="dash2-sync">
                  <i />
                  {dataSource === "cloud" ? "SYNCED" : "LOCAL"}
                </span>

                <span className="dash2-overview-date">
                  <Icon name="calendar" size={14} />
                  {formatDate()}
                  <span className="dash2-date-chevron">⌄</span>
                </span>
              </div>
            </div>

            <div className="dash2-overview-carousel">
              <button
                type="button"
                className="dash2-overview-nav dash2-overview-nav-left"
                aria-label="Show previous wellness metrics"
                onClick={(event) => event.currentTarget.parentElement.querySelector(".dash2-overview-grid")?.scrollBy({ left: -430, behavior: "smooth" })}
              >
                ‹
              </button>

              <div className="dash2-overview-grid">

              <article className="dash2-score-card">
                <div
                  className="dash2-score-ring"
                  style={{
                    "--score-deg": `${score * 3.6}deg`,
                  }}
                >
                  <div>
                    <span>WELLNESS</span>
                    <strong>{score}</strong>
                    <small>/100</small>
                  </div>
                </div>

                <div className="dash2-score-copy">
                  <small>Composite lifestyle signal</small>

                  <strong>
                    {score >= 85
                      ? "Strong rhythm"
                      : score >= 70
                        ? "Good momentum"
                        : score >= 50
                          ? "Room to improve"
                          : "Reset opportunity"}
                  </strong>

                  {trendDelta !== null && (
                    <em className={trendDelta >= 0 ? "up" : "down"}>
                      {trendDelta >= 0 ? "↑" : "↓"} {Math.abs(trendDelta)} from previous check-in
                    </em>
                  )}

                  <button
                    type="button"
                    className="dash2-score-action"
                    onClick={() => onNavigate?.("insights")}
                  >
                    <Icon name="trend" size={12} />
                    <span>Room to improve</span>
                  </button>
                </div>
              </article>

              <div className="dash2-metrics">
                <MetricCard
                  icon="steps"
                  label="Steps"
                  value={current.steps.toLocaleString("en-IN")}
                  progress={(current.steps / Math.max(goals.steps, 1)) * 100}
                  helper="Movement"
                  target={`${Math.round((current.steps / Math.max(goals.steps, 1)) * 100)}% of goal`}
                  tone="green"
                />

                <MetricCard
                  icon="moon"
                  label="Sleep"
                  value={current.sleep.toFixed(1)}
                  unit="h"
                  progress={(current.sleep / Math.max(goals.sleep, 1)) * 100}
                  helper="Recovery"
                  target={`Goal ${goals.sleep.toFixed(1)}h`}
                  tone="violet"
                />

                <MetricCard
                  icon="water"
                  label="Water"
                  value={current.water}
                  unit=" glasses"
                  progress={(current.water / Math.max(goals.water, 1)) * 100}
                  helper="Hydration"
                  target={`Goal ${goals.water}`}
                  tone="cyan"
                />

                <MetricCard
                  icon="screen"
                  label="Screen"
                  value={current.screenTime.toFixed(1)}
                  unit="h"
                  progress={100 - Math.max(current.screenTime - goals.screenTime, 0) * 15}
                  helper="Digital balance"
                  target={`Target ≤ ${goals.screenTime.toFixed(1)}h`}
                  tone="orange"
                />

                <MetricCard
                  icon="energy"
                  label="Energy"
                  value={current.energy}
                  unit="/10"
                  progress={current.energy * 10}
                  helper="Capacity"
                  target="Scale 0–10"
                  tone="pink"
                />
              </div>
              </div>

              <button
                type="button"
                className="dash2-overview-nav dash2-overview-nav-right"
                aria-label="Show more wellness metrics"
                onClick={(event) => event.currentTarget.parentElement.querySelector(".dash2-overview-grid")?.scrollBy({ left: 430, behavior: "smooth" })}
              >
                ›
              </button>
            </div>
          </section>

          <section className="dash2-brief glass-panel">
            <div className="dash2-brief-top"><div><div className="dash2-ai-chip"><Icon name="spark" size={13} /> AI WELLNESS BRIEF</div><h2>{aiBriefLoading ? "WELLsync is reading today's context..." : brief.headline}</h2></div><span><i /> GEMINI</span></div>
            <p className="dash2-brief-body">{brief.body}</p>
            <div className="dash2-brief-grid">
              <div><span>FOCUS</span><strong>{brief.focus}</strong><small>One useful priority for today.</small></div>
              <div><span>WHY?</span><strong>Context matters</strong><small>{brief.body}</small></div>
              <div><span>DO THIS TODAY</span><ol>{brief.actions.map((action, index) => <li key={`${action}-${index}`}>{action}</li>)}</ol></div>
            </div>
            <div className="dash2-brief-actions"><button className="dash2-primary" onClick={() => openAi("Review my current wellness data and turn today's AI brief into a practical plan for the rest of the day.")}>Ask WELLsync AI <Icon name="arrow" size={15} /></button><button className="dash2-secondary" onClick={() => onNavigate?.("insights")}>View insights</button></div>
          </section>
        </div>

        <aside className="dash2-right">
          <section className="dash2-coach glass-panel">
            <div className="dash2-section-head"><div><div className="dash2-eyebrow">YOUR AI COACH</div><h2>WELLsync AI</h2></div><span className="dash2-online"><i /> ONLINE</span></div>
            <div className="dash2-ai-orb"><div className="dash2-ai-star a">✦</div><div className="dash2-ai-star b">✦</div><div className="dash2-ai-star c">✦</div><div className="dash2-ai-face">⌣</div></div>
            <h3>Your personal intelligence layer.</h3><p>Ask about your routine, recovery, goals or current wellness context.</p>
            <div className="dash2-coach-buttons"><button onClick={() => openAi("What should I focus on today?")}>Chat Now <small>Ask anything</small></button><button onClick={() => onNavigate?.("insights")}>View Insights <small>Patterns & context</small></button></div>
            <button className="dash2-coach-input" onClick={() => openAi("Give me a concise overview of what matters most in my wellness today.")}><span><Icon name="search" size={15} /></span><strong>Ask me anything...</strong><b><Icon name="arrow" size={15} /></b></button>
          </section>
        </aside>
      </main>

      <section className="dash2-bottom-grid">
        <article className="dash2-quick glass-panel"><div className="dash2-section-head"><div><div className="dash2-eyebrow">QUICK ACTIONS</div><h2>Move without friction.</h2></div></div><div className="dash2-quick-grid"><button onClick={() => onNavigate?.("checkin")}><Icon name="calendar" size={18} /> Daily Check-In</button><button onClick={() => onNavigate?.("goals")}><Icon name="trend" size={18} /> Set Goals</button><button onClick={() => onNavigate?.("insights")}><Icon name="spark" size={18} /> View Insights</button><button onClick={() => onNavigate?.("analytics")}><Icon name="trend" size={18} /> Analytics</button></div></article>
        <article className="dash2-goals glass-panel"><div className="dash2-section-head"><div><div className="dash2-eyebrow">TODAY'S GOALS</div><h2>Progress at a glance.</h2></div><button className="dash2-link" onClick={() => onNavigate?.("goals")}>Edit goals <Icon name="arrow" size={14} /></button></div><div className="dash2-goals-list"><GoalItem icon="steps" label="Steps" current={current.steps} goal={goals.steps} /><GoalItem icon="moon" label="Sleep" current={current.sleep} goal={goals.sleep} unit="h" /><GoalItem icon="water" label="Water" current={current.water} goal={goals.water} /><GoalItem icon="screen" label="Screen" current={current.screenTime} goal={goals.screenTime} unit="h" inverse /></div></article>
      </section>
    </div>
  );
}

function BackgroundScene({ theme }) {
  return (
    <div className="dash2-background" aria-hidden="true">
      <div className="dash2-photo dash2-photo-morning" />
      <div className="dash2-photo dash2-photo-day" />
      <div className="dash2-photo dash2-photo-evening" />
      <div className="dash2-photo dash2-photo-night" />
      <div className="dash2-background-fade" />
      <div className="dash2-background-vignette" />
    </div>
  );
}

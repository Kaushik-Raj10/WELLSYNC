import { useEffect, useMemo, useState } from "react";

import {
  getCloudCheckins,
  getCloudGoals,
  getLatestCloudCheckin,
} from "../utils/supabaseData";

import {
  getGoals,
  getWellnessData,
  getWellnessHistory,
} from "../utils/wellnessData";

import { calculateWellnessScore } from "../utils/wellnessScore";
import "./AICompanion.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function normalizeWellnessData(data) {
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

function normalizeGoals(data) {
  if (!data) return null;

  return {
    sleep: Number(data.sleep ?? 7),
    water: Number(data.water ?? 6),
    steps: Number(data.steps ?? 6000),
    screenTime: Number(data.screenTime ?? data.screen_time ?? 6),
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
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-30);
}

function createWelcomeMessage() {
  return {
    role: "assistant",
    content:
      "Welcome to your WELLsync intelligence center.\n\nAsk about your routine, training, nutrition, recovery, goals, or the patterns inside your wellness data. I’ll use the context available to me and explain the reasoning in practical terms.",
  };
}

function getMoodEmoji(mood) {
  const moods = {
    Great: "😄",
    Good: "🙂",
    Okay: "😐",
    Low: "😕",
    Stressed: "😣",
  };

  return moods[mood] || "🙂";
}

function getModeLabel(mode) {
  const labels = {
    general: "General",
    trainer: "Trainer",
    nutrition: "Nutrition",
    recovery: "Recovery",
    data_analyst: "Data Analyst",
    goals: "Goal Coach",
  };

  return labels[mode] || "General";
}

function getPriorities(data, goals) {
  if (!data) return [];

  const target =
    normalizeGoals(goals) || {
      sleep: 7,
      water: 6,
      steps: 6000,
      screenTime: 6,
    };

  const priorities = [];

  if (data.sleep < target.sleep) {
    priorities.push({ label: "Sleep", value: `${data.sleep}h`, detail: `Goal ${target.sleep}h`, icon: "◐" });
  }
  if (data.water < target.water) {
    priorities.push({ label: "Hydration", value: `${data.water}`, detail: `Goal ${target.water}`, icon: "◇" });
  }
  if (data.steps < target.steps) {
    priorities.push({ label: "Movement", value: data.steps.toLocaleString(), detail: `Goal ${target.steps.toLocaleString()}`, icon: "↗" });
  }
  if (data.screenTime > target.screenTime) {
    priorities.push({ label: "Screen time", value: `${data.screenTime}h`, detail: `Target ${target.screenTime}h`, icon: "□" });
  }
  if (data.stress >= 7) {
    priorities.push({ label: "Stress", value: `${data.stress}/10`, detail: "Recovery focus", icon: "∿" });
  }
  if (data.energy <= 4) {
    priorities.push({ label: "Energy", value: `${data.energy}/10`, detail: "Protect your capacity", icon: "✦" });
  }

  return priorities;
}

function Metric({ label, value, suffix, accent }) {
  return (
    <div className={`ai-pro-metric ${accent ? `is-${accent}` : ""}`}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix && <small>{suffix}</small>}
      </strong>
    </div>
  );
}

function ScoreRing({ score }) {
  const degrees = `${Math.max(0, Math.min(score, 100)) * 3.6}deg`;

  return (
    <div
      className="ai-pro-score-ring"
      style={{
        background: `conic-gradient(from -90deg, var(--ai-accent) ${degrees}, rgba(255,255,255,.08) ${degrees})`,
      }}
    >
      <div className="ai-pro-score-ring-inner">
        <span>WELLNESS</span>
        <strong>{score}</strong>
        <small>/100</small>
      </div>
    </div>
  );
}

function TrendSparkline({ history }) {
  const points = useMemo(() => {
    return normalizeHistory(history)
      .slice(-10)
      .map((item, index) => ({
        x: 12 + index * (176 / Math.max(normalizeHistory(history).slice(-10).length - 1, 1)),
        y: 82 - (calculateWellnessScore(item) / 100) * 64,
        score: calculateWellnessScore(item),
      }));
  }, [history]);

  if (!points.length) {
    return (
      <div className="ai-pro-empty-trend">
        <span>NO TREND YET</span>
        <p>Complete more check-ins to unlock pattern analysis.</p>
      </div>
    );
  }

  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${points[0].x},92 ${line} ${points[points.length - 1].x},92`;

  return (
    <div className="ai-pro-trend-wrap">
      <svg viewBox="0 0 200 100" role="img" aria-label="Recent wellness score trend">
        <defs>
          <linearGradient id="aiTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M ${area.replaceAll(" ", " L ")}`} fill="url(#aiTrendFill)" stroke="none" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="2.6" fill="currentColor" />
        ))}
      </svg>
      <div className="ai-pro-trend-meta">
        <span>{points[0]?.score ?? 0} start</span>
        <strong>{points[points.length - 1]?.score ?? 0} latest</strong>
      </div>
    </div>
  );
}

export default function AICompanion() {
  const localData = useMemo(() => {
    try {
      return normalizeWellnessData(getWellnessData());
    } catch {
      return null;
    }
  }, []);

  const localGoals = useMemo(() => {
    try {
      return normalizeGoals(getGoals());
    } catch {
      return null;
    }
  }, []);

  const localHistory = useMemo(() => {
    try {
      return normalizeHistory(getWellnessHistory());
    } catch {
      return [];
    }
  }, []);

  const [wellnessData, setWellnessData] = useState(localData);
  const [goals, setGoals] = useState(localGoals);
  const [history, setHistory] = useState(localHistory);
  const [messages, setMessages] = useState([createWelcomeMessage()]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [agenticMode, setAgenticMode] = useState(false);
  const [aiSource, setAiSource] = useState("gemini");
  const [webMode, setWebMode] = useState("auto");
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);
  const [currentMode, setCurrentMode] = useState("general");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedData = useMemo(() => normalizeWellnessData(wellnessData), [wellnessData]);
  const normalizedGoals = useMemo(() => normalizeGoals(goals), [goals]);
  const normalizedHistory = useMemo(() => normalizeHistory(history), [history]);

  const score = useMemo(() => {
    if (!normalizedData) return 0;
    return calculateWellnessScore(normalizedData);
  }, [normalizedData]);

  const priorities = useMemo(
    () => getPriorities(normalizedData, normalizedGoals),
    [normalizedData, normalizedGoals]
  );

  async function loadWellnessContext() {
    setRefreshing(true);

    const results = await Promise.allSettled([
      getLatestCloudCheckin(),
      getCloudGoals(),
      getCloudCheckins(),
    ]);

    const cloudData = results[0].status === "fulfilled" ? normalizeWellnessData(results[0].value) : null;
    const cloudGoals = results[1].status === "fulfilled" ? normalizeGoals(results[1].value) : null;
    const cloudHistory = results[2].status === "fulfilled" ? normalizeHistory(results[2].value) : [];

    if (cloudData) setWellnessData(cloudData);
    if (cloudGoals) setGoals(cloudGoals);
    if (cloudHistory.length) setHistory(cloudHistory);

    try {
      const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
      const health = await response.json();
      setBackendOnline(response.ok && health.status === "healthy");
      setAgenticMode(Boolean(health.automatic_function_calling || health.agentic_mode));
      setWebSearchAvailable(Boolean(health.web_search_available));
    } catch {
      setBackendOnline(false);
      setAgenticMode(false);
      setWebSearchAvailable(false);
    }

    setRefreshing(false);
  }

  useEffect(() => {
    const timer = setTimeout(loadWellnessContext, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let pendingPrompt = "";
    let pendingMode = "";

    try {
      pendingPrompt = sessionStorage.getItem("wellsync_ai_prompt") || "";
      pendingMode = sessionStorage.getItem("wellsync_ai_mode") || "";

      sessionStorage.removeItem("wellsync_ai_prompt");
      sessionStorage.removeItem("wellsync_ai_mode");
    } catch {
      return undefined;
    }

    if (!pendingPrompt) return undefined;

    if (pendingMode) {
      setCurrentMode(pendingMode);
    }

    const timer = setTimeout(() => {
      sendMessage(pendingPrompt);
    }, 180);

    return () => clearTimeout(timer);
  }, []);

  async function sendMessage(text = input) {
    const cleanText = String(text || "").trim();
    if (!cleanText || sending) return;

    setErrorMessage("");
    const userMessage = { role: "user", content: cleanText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);

    try {
      const conversation = updatedMessages.slice(-10).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const requestBody = {
        message: cleanText,
        wellness_data: normalizedData,
        goals: normalizedGoals,
        history: currentMode === "data_analyst" ? normalizedHistory.slice(-30) : normalizedHistory.slice(-7),
        device_data: {},
        profile: {},
        mode: currentMode,
        web_mode: webMode,
        conversation,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response;
      try {
        response = await fetch(`${API_URL}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(result?.detail || `AI server returned ${response.status}`);
      }

      setBackendOnline(true);
      setAiSource(result?.source || "gemini");

      if (result?.mode) setCurrentMode(result.mode);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result?.response || "I couldn't generate a response right now.",
          webGrounded: Boolean(result?.web_grounded),
          webSources: Array.isArray(result?.web_sources) ? result.web_sources : [],
          webQueries: Array.isArray(result?.web_search_queries) ? result.web_search_queries : [],
        },
      ]);
    } catch (error) {
      const message =
        error?.name === "AbortError"
          ? "The AI took too long to respond. Please try again."
          : error?.message || "The AI service is temporarily unavailable.";

      setErrorMessage(message);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "I couldn't complete that request. Check the connection status and try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function resetConversation() {
    setMessages([createWelcomeMessage()]);
    setErrorMessage("");
    setInput("");
  }

  const modes = [
    { id: "general", icon: "✦", label: "General" },
    { id: "trainer", icon: "↗", label: "Trainer" },
    { id: "nutrition", icon: "⌘", label: "Nutrition" },
    { id: "recovery", icon: "◐", label: "Recovery" },
    { id: "data_analyst", icon: "⌁", label: "Data" },
    { id: "goals", icon: "◎", label: "Goals" },
  ];

  const webModes = [
    {
      id: "auto",
      icon: "✦",
      label: "Auto",
      description: "AI decides when live web context is useful",
    },
    {
      id: "live_web",
      icon: "◎",
      label: "Live Web",
      description: "Search current public web information",
    },
    {
      id: "personal_data",
      icon: "◌",
      label: "Personal Data",
      description: "Use WELLsync context without web search",
    },
  ];

  const webModeLabel = webModes.find((item) => item.id === webMode)?.label || "Auto";

  function openWebSource(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const suggestedQuestions = {
    general: ["What deserves my attention today?", "Explain what changed in my wellness."],
    trainer: ["Create a beginner full-body workout for today.", "Build me a short movement session."],
    nutrition: ["Give me balanced meal ideas for today.", "Suggest a quick breakfast with good variety."],
    recovery: ["How can I make tonight more restorative?", "Help me improve my evening routine."],
    data_analyst: ["Analyze my wellness trends.", "What patterns are visible in my recent data?"],
    goals: ["Which goal needs attention today?", "Help me build a realistic routine around my goals."],
  };

  return (
    <div className="ai-pro-page">
      <div className="ai-pro-orb ai-pro-orb-one" />
      <div className="ai-pro-orb ai-pro-orb-two" />

      <header className="ai-pro-header">
        <div>
          <div className="ai-pro-kicker"><span>✦</span> INTELLIGENCE CENTER</div>
          <h1>Ask WELLsync <em>anything.</em></h1>
          <p>One adaptive AI layer for your routine, goals, training, nutrition, recovery, and personal wellness data.</p>
        </div>

        <div className="ai-pro-header-actions">
          <div className={`ai-pro-connection ${backendOnline ? "online" : ""}`}>
            <span className="ai-pro-connection-dot" />
            {backendOnline ? "AI online" : "Connecting..."}
          </div>
          <div className="ai-pro-engine">
            <span>ENGINE</span>
            {String(aiSource).toLowerCase().includes("gemini") ? "Gemini" : "AI"}
          </div>
          <div className={`ai-pro-web-status ${webSearchAvailable && webMode !== "personal_data" ? "enabled" : ""}`}>
            <span>WEB</span>
            {webSearchAvailable && webMode !== "personal_data" ? "Available" : "Off"}
          </div>
          <button type="button" className="ai-pro-icon-button" onClick={resetConversation} title="Reset conversation">↻</button>
          <button type="button" className="ai-pro-icon-button" onClick={loadWellnessContext} disabled={refreshing} title="Refresh context">{refreshing ? "…" : "⟳"}</button>
        </div>
      </header>

      {errorMessage && <div className="ai-pro-error">{errorMessage}</div>}

      <section className="ai-pro-intel-strip">
        <div className="ai-pro-intel-main">
          <div className="ai-pro-badge">✦ {webMode === "live_web" ? "LIVE WEB + CONTEXT" : webMode === "personal_data" ? "PERSONAL CONTEXT" : "LIVE CONTEXT"}</div>
          <h2>
            {normalizedData
              ? `Your current wellness signal is ${score}/100.`
              : "Your AI workspace is ready."}
          </h2>
          <p>
            {normalizedData
              ? `WELLsync is using ${normalizedHistory.length || 1} recent check-in${normalizedHistory.length === 1 ? "" : "s"}, your current goals, and today’s signals.`
              : "Complete a daily check-in to give the AI more personal context."}
          </p>
        </div>
        <div className="ai-pro-intel-stats">
          <div><strong>{normalizedHistory.length}</strong><span>check-ins</span></div>
          <div><strong>{priorities.length || 0}</strong><span>focus areas</span></div>
          <div><strong>{agenticMode ? "ON" : "—"}</strong><span>agent tools</span></div>
          <div><strong>{webMode === "live_web" ? "WEB" : webMode === "personal_data" ? "DATA" : "AUTO"}</strong><span>web policy</span></div>
        </div>
      </section>

      <section className="ai-pro-web-rail">
        <div className="ai-pro-web-title">
          <span>KNOWLEDGE ACCESS</span>
          <strong>{webModeLabel}</strong>
        </div>
        <div className="ai-pro-web-buttons">
          {webModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={webMode === mode.id ? "active" : ""}
              disabled={sending || (mode.id !== "personal_data" && !webSearchAvailable)}
              onClick={() => setWebMode(mode.id)}
              title={webSearchAvailable || mode.id === "personal_data" ? mode.description : "Live web access is unavailable on the backend"}
            >
              <span>{mode.icon}</span>
              <div>
                <strong>{mode.label}</strong>
                <small>{mode.description}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="ai-pro-mode-rail">
        <div className="ai-pro-mode-title"><span>ASK MODE</span><strong>{getModeLabel(currentMode)}</strong></div>
        <div className="ai-pro-mode-buttons">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={currentMode === mode.id ? "active" : ""}
              disabled={sending}
              onClick={() => setCurrentMode(mode.id)}
            >
              <span>{mode.icon}</span>{mode.label}
            </button>
          ))}
        </div>
      </div>

      <main className="ai-pro-layout">
        <section className="ai-pro-chat-card">
          <div className="ai-pro-chat-topbar">
            <div className="ai-pro-agent">
              <div className="ai-pro-agent-mark">✦</div>
              <div>
                <strong>WELLsync AI</strong>
                <span>{agenticMode ? `Agentic context active · ${webMode === "live_web" ? "live web enabled" : webMode === "personal_data" ? "personal data only" : "web auto"}` : "Context-aware wellness AI"}</span>
              </div>
            </div>
            <div className="ai-pro-mode-indicator">{getModeLabel(currentMode)}</div>
          </div>

          <div className="ai-pro-message-list">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={`ai-pro-message-row ${isUser ? "user" : "assistant"}`}>
                  {!isUser && <div className="ai-pro-message-mark">✦</div>}
                  <div className={`ai-pro-message-bubble ${isUser ? "user" : "assistant"}`}>
                    {String(message.content).split("\n").map((line, lineIndex) => (
                      <p key={lineIndex}>{line || "\u00A0"}</p>
                    ))}
                    {!isUser && message.webGrounded && message.webSources?.length > 0 && (
                      <div className="ai-pro-web-sources">
                        <div className="ai-pro-web-sources-head">
                          <span>⌁ LIVE WEB RESEARCH</span>
                          <strong>{message.webSources.length} source{message.webSources.length === 1 ? "" : "s"}</strong>
                        </div>
                        <div className="ai-pro-web-source-list">
                          {message.webSources.slice(0, 5).map((source, sourceIndex) => (
                            <button
                              key={`${source.url}-${sourceIndex}`}
                              type="button"
                              onClick={() => openWebSource(source.url)}
                              title={source.url}
                            >
                              <span className="ai-pro-web-source-index">{sourceIndex + 1}</span>
                              <span className="ai-pro-web-source-copy">
                                <strong>{source.title || "Web source"}</strong>
                                <small>{source.url}</small>
                              </span>
                              <span className="ai-pro-web-source-arrow">↗</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="ai-pro-message-row assistant">
                <div className="ai-pro-message-mark">✦</div>
                <div className="ai-pro-message-bubble assistant ai-pro-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="ai-pro-prompt-zone">
            <div className="ai-pro-prompt-title">Try one of these</div>
            <div className="ai-pro-prompt-chips">
              {(suggestedQuestions[currentMode] || suggestedQuestions.general).map((question) => (
                <button key={question} type="button" onClick={() => sendMessage(question)} disabled={sending}>
                  {question}<span>↗</span>
                </button>
              ))}
            </div>
          </div>

          <form className="ai-pro-composer" onSubmit={handleSubmit}>
            <div className="ai-pro-input-icon">✦</div>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                webMode === "live_web"
                  ? "Ask WELLsync to research the live web..."
                  : currentMode === "trainer"
                  ? "Ask for a movement or workout plan..."
                  : currentMode === "nutrition"
                    ? "Ask about meals or nutrition..."
                    : currentMode === "recovery"
                      ? "Ask about sleep, recovery, or routines..."
                      : currentMode === "data_analyst"
                        ? "Ask me to analyze your wellness data..."
                        : currentMode === "goals"
                          ? "Ask me about your goals..."
                          : "Ask WELLsync anything..."
              }
              disabled={sending}
              autoComplete="off"
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send message">
              {sending ? "…" : "↑"}
            </button>
          </form>
          <div className="ai-pro-disclaimer">General wellness guidance only · not a medical diagnosis or emergency service. Live Web uses retrieved public web sources when enabled.</div>
        </section>

        <aside className="ai-pro-sidebar">
          <section className="ai-pro-side-card ai-pro-score-card">
            <div className="ai-pro-side-head"><span>YOUR SIGNAL</span><em>LIVE</em></div>
            <div className="ai-pro-score-layout">
              <ScoreRing score={score} />
              <div>
                <strong>{score >= 85 ? "Strong rhythm" : score >= 70 ? "Good momentum" : score >= 50 ? "Room to improve" : "Reset opportunity"}</strong>
                <p>Current composite wellness signal.</p>
              </div>
            </div>
          </section>

          <section className="ai-pro-side-card">
            <div className="ai-pro-side-head"><span>TODAY</span><em>{normalizedData ? "7 SIGNALS" : "NO DATA"}</em></div>
            <div className="ai-pro-metrics-grid">
              <Metric label="Sleep" value={normalizedData?.sleep ?? "—"} suffix="h" accent="purple" />
              <Metric label="Water" value={normalizedData?.water ?? "—"} suffix=" glasses" accent="cyan" />
              <Metric label="Steps" value={normalizedData ? normalizedData.steps.toLocaleString() : "—"} accent="green" />
              <Metric label="Screen" value={normalizedData?.screenTime ?? "—"} suffix="h" accent="orange" />
              <Metric label="Energy" value={normalizedData?.energy ?? "—"} suffix="/10" accent="pink" />
              <Metric label="Stress" value={normalizedData?.stress ?? "—"} suffix="/10" accent="blue" />
            </div>
            <div className="ai-pro-mood-line">
              <span>{getMoodEmoji(normalizedData?.mood)} Mood</span>
              <strong>{normalizedData?.mood || "—"}</strong>
            </div>
          </section>

          <section className="ai-pro-side-card">
            <div className="ai-pro-side-head"><span>RECENT TREND</span><em>10 POINTS MAX</em></div>
            <TrendSparkline history={normalizedHistory} />
          </section>

          <section className="ai-pro-side-card">
            <div className="ai-pro-side-head"><span>FOCUS AREAS</span><em>{priorities.length}</em></div>
            {priorities.length ? (
              <div className="ai-pro-focus-list">
                {priorities.slice(0, 4).map((item) => (
                  <div className="ai-pro-focus-item" key={item.label}>
                    <div className="ai-pro-focus-icon">{item.icon}</div>
                    <div><strong>{item.label}</strong><span>{item.value} · {item.detail}</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-pro-focus-empty">Your current signals are not flagging a specific focus area.</div>
            )}
          </section>

          <section className="ai-pro-side-card ai-pro-goals-card">
            <div className="ai-pro-side-head"><span>GOALS</span><em>ACTIVE</em></div>
            <div className="ai-pro-goal-line"><span>Sleep</span><strong>{normalizedGoals?.sleep ?? "—"}h</strong></div>
            <div className="ai-pro-goal-line"><span>Water</span><strong>{normalizedGoals?.water ?? "—"}</strong></div>
            <div className="ai-pro-goal-line"><span>Steps</span><strong>{normalizedGoals ? normalizedGoals.steps.toLocaleString() : "—"}</strong></div>
            <div className="ai-pro-goal-line"><span>Screen cap</span><strong>{normalizedGoals?.screenTime ?? "—"}h</strong></div>
          </section>
        </aside>
      </main>
    </div>
  );
}

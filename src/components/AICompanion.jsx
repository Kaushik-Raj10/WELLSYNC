import { useEffect, useMemo, useState } from "react";

import {
  getLatestCloudCheckin,
  getCloudGoals,
} from "../utils/supabaseData";

import { getWellnessData } from "../utils/wellnessData";
import { calculateWellnessScore } from "../utils/wellnessScore";

import "../App.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";


/* =========================================================
   DATA HELPERS
========================================================= */

function normalizeWellnessData(data) {
  if (!data) return null;

  return {
    sleep: Number(data.sleep ?? 0),
    water: Number(data.water ?? 0),
    steps: Number(data.steps ?? 0),

    screenTime: Number(
      data.screenTime ??
      data.screen_time ??
      0
    ),

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

    screenTime: Number(
      data.screenTime ??
      data.screen_time ??
      6
    ),
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


/* =========================================================
   PRIORITY ENGINE
========================================================= */

function getPriorities(data, goals) {
  if (!data) return [];

  const target = normalizeGoals(goals) || {
    sleep: 7,
    water: 6,
    steps: 6000,
    screenTime: 6,
  };

  const priorities = [];

  if (data.sleep < target.sleep) {
    priorities.push({
      area: "sleep",
      title: "Protect your sleep routine",
      shortTitle: "Sleep",
      icon: "🌙",
      gap: target.sleep - data.sleep,
      weight: (target.sleep - data.sleep) * 20,
      action:
        "Create a consistent wind-down period tonight and protect your planned sleep window.",
      reason:
        `You're at ${data.sleep}h against a ${target.sleep}h goal.`,
    });
  }

  if (data.water < target.water) {
    priorities.push({
      area: "hydration",
      title: "Close your hydration gap",
      shortTitle: "Hydration",
      icon: "💧",
      gap: target.water - data.water,
      weight: (target.water - data.water) * 15,
      action:
        "Spread your remaining water intake across the rest of the day.",
      reason:
        `You're at ${data.water} glasses against a ${target.water}-glass goal.`,
    });
  }

  if (data.steps < target.steps) {
    const gap =
      target.steps - data.steps;

    priorities.push({
      area: "activity",
      title: "Add a little more movement",
      shortTitle: "Movement",
      icon: "🚶",
      gap,
      weight:
        (gap / Math.max(target.steps, 1)) * 100,
      action:
        "Add a short walk or a few movement breaks between study or work blocks.",
      reason:
        `You're at ${data.steps.toLocaleString()} steps against a ${target.steps.toLocaleString()}-step goal.`,
    });
  }

  if (data.screenTime > target.screenTime) {
    const excess =
      data.screenTime - target.screenTime;

    priorities.push({
      area: "screen",
      title: "Create a screen-free window",
      shortTitle: "Screen time",
      icon: "📱",
      gap: excess,
      weight: excess * 18,
      action:
        "Take one intentional screen-free break, especially around your recovery or bedtime routine.",
      reason:
        `You're at ${data.screenTime}h against a ${target.screenTime}h target.`,
    });
  }

  if (data.stress >= 7) {
    priorities.push({
      area: "stress",
      title: "Create a recovery window",
      shortTitle: "Stress",
      icon: "🧘",
      gap: data.stress - 6,
      weight: (data.stress - 6) * 25,
      action:
        "Pause from your current task for a few minutes, reset, then return to one manageable task.",
      reason:
        `Your current stress signal is ${data.stress}/10.`,
    });
  }

  if (data.energy <= 4) {
    priorities.push({
      area: "energy",
      title: "Reduce the pressure on yourself",
      shortTitle: "Energy",
      icon: "⚡",
      gap: 5 - data.energy,
      weight: (5 - data.energy) * 20,
      action:
        "Choose one meaningful task instead of trying to maximize your entire day.",
      reason:
        `Your current energy signal is ${data.energy}/10.`,
    });
  }

  return priorities.sort(
    (a, b) => b.weight - a.weight
  );
}


/* =========================================================
   TODAY'S PLAN
========================================================= */

function buildTodayPlan(
  data,
  goals
) {
  if (!data) {
    return {
      focus: {
        title: "Complete your first check-in",
        icon: "✨",
      },
      actions: [
        {
          icon: "✓",
          title: "Complete Daily Check-In",
          description:
            "Give WELLsync your current sleep, hydration, activity, screen time, mood, energy and stress data.",
        },
      ],
    };
  }

  const priorities =
    getPriorities(
      data,
      goals
    );

  if (priorities.length === 0) {
    return {
      focus: {
        title: "Maintain your rhythm",
        icon: "⚡",
      },
      actions: [
        {
          icon: "✓",
          title: "Keep your current routine consistent",
          description:
            "Your tracked signals are currently around your goals, so consistency is more useful than adding lots of new habits.",
        },
        {
          icon: "🌱",
          title: "Make one small improvement",
          description:
            "Choose one habit that already feels manageable and make it slightly more consistent today.",
        },
        {
          icon: "💬",
          title: "Check back in",
          description:
            "Use WELLsync again after your next meaningful change so the system can track the pattern.",
        },
      ],
    };
  }

  const selected =
    priorities.slice(0, 3);

  return {
    focus: {
      title: selected[0].title,
      icon: selected[0].icon,
    },

    actions: selected.map(
      (item) => ({
        icon: item.icon,
        title: item.title,
        description:
          item.action,
      })
    ),
  };
}


/* =========================================================
   INITIAL MESSAGE
========================================================= */

function createInitialMessage(
  data,
  goals
) {
  if (!data) {
    return {
      role: "assistant",
      content:
        "Hey! I'm WELLsync AI 👋\n\nComplete your Daily Check-In and I'll use your actual wellness context to make this conversation personal.",
    };
  }

  const score =
    calculateWellnessScore(data);

  const priorities =
    getPriorities(
      data,
      goals
    );

  if (priorities.length === 0) {
    return {
      role: "assistant",
      content:
        `Hey! I'm WELLsync AI 👋\n\nYour current wellness signal is ${score}/100. Your tracked habits are currently around your goals, so today's focus is consistency.\n\nAsk me about your score, sleep, hydration, activity, screen time, stress, energy, or what you should focus on today.`,
    };
  }

  return {
    role: "assistant",
    content:
      `Hey! I'm WELLsync AI 👋\n\nYour current wellness signal is ${score}/100. The clearest opportunity right now is ${priorities[0].shortTitle.toLowerCase()}.\n\nAsk me anything about your routine and I'll use your current wellness context to answer.`,
  };
}


/* =========================================================
   COMPONENT
========================================================= */

export default function AICompanion() {
  const [wellnessData, setWellnessData] =
    useState(null);

  const [goals, setGoals] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [backendOnline, setBackendOnline] =
    useState(false);

  const [aiSource, setAiSource] =
    useState("local-fallback");

  const [errorMessage, setErrorMessage] =
    useState("");


  /* =======================================================
     DERIVED
  ======================================================= */

  const normalizedData =
    useMemo(
      () =>
        normalizeWellnessData(
          wellnessData
        ),
      [wellnessData]
    );

  const normalizedGoals =
    useMemo(
      () =>
        normalizeGoals(goals),
      [goals]
    );

  const score =
    useMemo(() => {
      if (!normalizedData) return 0;

      return calculateWellnessScore(
        normalizedData
      );
    }, [normalizedData]);

  const priorities =
    useMemo(
      () =>
        getPriorities(
          normalizedData,
          normalizedGoals
        ),
      [
        normalizedData,
        normalizedGoals,
      ]
    );

  const todayPlan =
    useMemo(
      () =>
        buildTodayPlan(
          normalizedData,
          normalizedGoals
        ),
      [
        normalizedData,
        normalizedGoals,
      ]
    );


  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadWellnessContext() {
    setLoading(true);
    setErrorMessage("");

    let latestData = null;
    let latestGoals = null;

    try {
      latestData =
        await getLatestCloudCheckin();
    } catch (error) {
      console.warn(
        "Cloud check-in unavailable:",
        error
      );
    }

    try {
      latestGoals =
        await getCloudGoals();
    } catch (error) {
      console.warn(
        "Cloud goals unavailable:",
        error
      );
    }

    if (!latestData) {
      try {
        latestData =
          getWellnessData();
      } catch (error) {
        console.warn(
          "Local wellness data unavailable:",
          error
        );
      }
    }

    const data =
      normalizeWellnessData(
        latestData
      );

    const goalData =
      normalizeGoals(
        latestGoals
      );

    setWellnessData(data);
    setGoals(goalData);

    setMessages([
      createInitialMessage(
        data,
        goalData
      ),
    ]);

    try {
      const response =
        await fetch(
          `${API_URL}/health`
        );

      if (response.ok) {
        const health =
          await response.json();

        setBackendOnline(
          health.status === "healthy"
        );
      } else {
        setBackendOnline(false);
      }
    } catch (error) {
      setBackendOnline(false);
    }

    setLoading(false);
  }


  useEffect(() => {
    loadWellnessContext();
  }, []);


  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  async function sendMessage(
    text = input
  ) {
    const cleanText =
      String(text || "").trim();

    if (
      !cleanText ||
      sending
    ) {
      return;
    }

    setErrorMessage("");

    const userMessage = {
      role: "user",
      content: cleanText,
    };

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(
      updatedMessages
    );

    setInput("");
    setSending(true);

    try {
      /*
       * We send the last few messages so the backend
       * can understand follow-up questions such as:
       *
       * "Why?"
       * "What about sleep?"
       * "How can I fix that?"
       */
      const conversation =
        updatedMessages
          .slice(-8)
          .map((message) => ({
            role:
              message.role,
            content:
              message.content,
          }));

      const requestBody = {
        message: cleanText,

        wellness_data:
          normalizedData,

        goals:
          normalizedGoals,

        conversation,
      };

      console.log(
        "WELLsync AI request:",
        requestBody
      );

      const response =
        await fetch(
          `${API_URL}/ai/chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                requestBody
              ),
          }
        );

      if (!response.ok) {
        throw new Error(
          `AI server returned ${response.status}`
        );
      }

      const result =
        await response.json();

      console.log(
        "WELLsync AI response:",
        result
      );

      setAiSource(
        result.source ||
        "local-fallback"
      );

      const answer =
        result.response ||
        result.message ||
        result.reply ||
        "I couldn't generate a response right now.";

      setMessages(
        (current) => [
          ...current,
          {
            role: "assistant",
            content: answer,
          },
        ]
      );
    } catch (error) {
      console.error(
        "WELLsync AI error:",
        error
      );

      setErrorMessage(
        "I couldn't connect to the AI service. Make sure the Python backend is running on port 8000."
      );

      setMessages(
        (current) => [
          ...current,
          {
            role: "assistant",
            content:
              "I couldn't reach the AI service right now. Please make sure the Python backend is running and try again.",
          },
        ]
      );
    } finally {
      setSending(false);
    }
  }


  function handleSubmit(
    event
  ) {
    event.preventDefault();
    sendMessage();
  }


  /* =======================================================
     SUGGESTED QUESTIONS
  ======================================================= */

  const suggestedQuestions = [
    "What should I focus on today?",
    "Why is my wellness score what it is?",
    "How can I improve my wellness score?",
    "How is my sleep today?",
    "Why is hydration a priority?",
    "What could be affecting my energy?",
  ];


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="ai-page-loading">
        <div className="loading-spinner" />

        <p>
          Building your personalized wellness context...
        </p>
      </div>
    );
  }


  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="ai-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="ai-page-header">

        <div>

          <p className="dashboard-eyebrow">
            YOUR INTELLIGENT WELLNESS COMPANION
          </p>

          <h1>
            Talk to{" "}
            <span>
              WELLsync AI.
            </span>
          </h1>

          <p className="ai-page-subtitle">
            Ask questions, understand your
            patterns, and decide what to focus
            on next.
          </p>

        </div>


        <div className="ai-status-group">

          <div className="ai-status-pill">

            <span
              className={`ai-status-dot ${
                backendOnline
                  ? "online"
                  : ""
              }`}
            />

            {backendOnline
              ? "AI service online"
              : "AI service offline"}

          </div>


          <div className="ai-source-pill">

            {aiSource === "openai"
              ? "Powered by OpenAI"
              : "Personalized local mode"}

          </div>

        </div>

      </div>


      {/* =================================================
          ERROR
      ================================================= */}

      {errorMessage && (
        <div className="ai-error-banner">
          {errorMessage}
        </div>
      )}


      {/* =================================================
          WORKSPACE
      ================================================= */}

      <div className="ai-workspace">

        {/* =================================================
            CHAT
        ================================================= */}

        <section className="ai-chat-panel">

          <div className="ai-chat-header">

            <div className="ai-chat-avatar">
              ✦
            </div>

            <div>

              <h2>
                WELLsync AI
              </h2>

              <p>
                Context-aware wellness conversation
              </p>

            </div>

            <div className="ai-chat-live">

              <span />

              Ready

            </div>

          </div>


          <div className="ai-messages">

            {messages.map(
              (message, index) => {

                const isUser =
                  message.role ===
                  "user";

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`ai-message-row ${
                      isUser
                        ? "user-message-row"
                        : "assistant-message-row"
                    }`}
                  >

                    {!isUser && (
                      <div className="ai-message-avatar">
                        ✦
                      </div>
                    )}

                    <div
                      className={`ai-message ${
                        isUser
                          ? "user-message"
                          : "assistant-message"
                      }`}
                    >
                      {message.content}
                    </div>

                  </div>
                );
              }
            )}


            {sending && (
              <div className="ai-message-row assistant-message-row">

                <div className="ai-message-avatar">
                  ✦
                </div>

                <div className="ai-message assistant-message ai-typing">

                  <span />
                  <span />
                  <span />

                </div>

              </div>
            )}

          </div>


          {/* Suggested prompts */}

          <div className="ai-suggestions">

            {suggestedQuestions.map(
              (question) => (
                <button
                  key={question}
                  type="button"
                  disabled={sending}
                  onClick={() =>
                    sendMessage(
                      question
                    )
                  }
                >
                  {question}
                </button>
              )
            )}

          </div>


          {/* Input */}

          <form
            className="ai-input-area"
            onSubmit={handleSubmit}
          >

            <input
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              placeholder="Ask WELLsync about your wellness..."
              disabled={sending}
              autoComplete="off"
            />

            <button
              type="submit"
              disabled={
                sending ||
                !input.trim()
              }
            >
              {sending
                ? "..."
                : "↑"}
            </button>

          </form>


          <p className="ai-disclaimer">
            WELLsync provides general
            lifestyle guidance and is not
            a medical diagnosis or emergency
            service.
          </p>

        </section>


        {/* =================================================
            CONTEXT SIDEBAR
        ================================================= */}

        <aside className="ai-context-panel">

          <div className="ai-context-heading">

            <p className="dashboard-card-label">
              YOUR CURRENT CONTEXT
            </p>

            <h2>
              What I know about today
            </h2>

          </div>


          {/* Score */}

          <div className="ai-score-mini-card">

            <div
              className="ai-mini-ring"
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


            <div>

              <p>
                Wellness score
              </p>

              <strong>
                {score >= 85
                  ? "Excellent rhythm"
                  : score >= 70
                    ? "Good momentum"
                    : score >= 50
                      ? "Room to improve"
                      : "Reset opportunity"}
              </strong>

            </div>

          </div>


          {/* Signals */}

          <div className="ai-context-grid">

            <div>
              <span>
                🌙 Sleep
              </span>
              <strong>
                {normalizedData
                  ? `${normalizedData.sleep}h`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                💧 Water
              </span>
              <strong>
                {normalizedData
                  ? normalizedData.water
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                🚶 Activity
              </span>
              <strong>
                {normalizedData
                  ? normalizedData.steps.toLocaleString()
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                📱 Screen
              </span>
              <strong>
                {normalizedData
                  ? `${normalizedData.screenTime}h`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                {getMoodEmoji(
                  normalizedData?.mood
                )} Mood
              </span>
              <strong>
                {normalizedData?.mood || "—"}
              </strong>
            </div>

            <div>
              <span>
                ⚡ Energy
              </span>
              <strong>
                {normalizedData
                  ? `${normalizedData.energy}/10`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                🧠 Stress
              </span>
              <strong>
                {normalizedData
                  ? `${normalizedData.stress}/10`
                  : "—"}
              </strong>
            </div>

          </div>


          {/* Next focus */}

          <div className="ai-priority-card">

            <p className="dashboard-card-label">
              NEXT BEST FOCUS
            </p>

            <div className="ai-priority-icon">
              {priorities[0]?.icon ||
                "✓"}
            </div>

            <h3>
              {priorities[0]?.shortTitle ||
                "Consistency"}
            </h3>

            <p>
              {priorities[0]?.reason ||
                "Your current tracked signals are around their goals."}
            </p>

          </div>


          {/* Today's Plan */}

          <div className="ai-today-plan-card">

            <div className="ai-today-plan-header">

              <div>

                <p className="dashboard-card-label">
                  TODAY'S WELLNESS PLAN
                </p>

                <h3>
                  {todayPlan.focus.title}
                </h3>

              </div>

              <span className="ai-plan-focus-icon">
                {todayPlan.focus.icon}
              </span>

            </div>


            <div className="ai-plan-actions">

              {todayPlan.actions.map(
                (action, index) => (
                  <div
                    className="ai-plan-action"
                    key={`${action.title}-${index}`}
                  >

                    <div className="ai-plan-number">
                      {index + 1}
                    </div>

                    <div>

                      <strong>
                        {action.title}
                      </strong>

                      <p>
                        {action.description}
                      </p>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>


          {/* Goals */}

          {normalizedGoals && (
            <div className="ai-goals-card">

              <p className="dashboard-card-label">
                YOUR GOALS
              </p>

              <div>
                <span>
                  Sleep
                </span>
                <strong>
                  {normalizedGoals.sleep}h
                </strong>
              </div>

              <div>
                <span>
                  Water
                </span>
                <strong>
                  {normalizedGoals.water}
                  {" "}glasses
                </strong>
              </div>

              <div>
                <span>
                  Steps
                </span>
                <strong>
                  {normalizedGoals.steps.toLocaleString()}
                </strong>
              </div>

              <div>
                <span>
                  Screen time
                </span>
                <strong>
                  {normalizedGoals.screenTime}h
                </strong>
              </div>

            </div>
          )}


          <button
            type="button"
            className="ai-refresh-button"
            onClick={
              loadWellnessContext
            }
            disabled={
              loading ||
              sending
            }
          >
            ↻ Refresh wellness context
          </button>

        </aside>

      </div>

    </div>
  );
}
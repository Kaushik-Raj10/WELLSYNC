import { useEffect, useMemo, useState } from "react";
import { getAgeGroup } from "../utils/ageUtils";
import "./DailyRecommendations.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const CACHE_PREFIX = "wellsync_daily_recommendations_v1";
const CHAT_STORAGE_KEY = "wellsync_ai_conversation_v1";

function normalizeData(data) {
  if (!data) return null;

  return {
    sleep: Number(data.sleep ?? 0),
    water: Number(data.water ?? 0),
    steps: Number(data.steps ?? 0),
    screenTime: Number(
      data.screenTime ?? data.screen_time ?? 0
    ),
    mood: data.mood ?? "Okay",
    energy: Number(data.energy ?? 5),
    stress: Number(data.stress ?? 5),
  };
}

function normalizeGoals(data) {
  return {
    sleep: Number(data?.sleep ?? 7),
    water: Number(data?.water ?? 6),
    steps: Number(data?.steps ?? 6000),
    screenTime: Number(
      data?.screenTime ?? data?.screen_time ?? 6
    ),
  };
}

function normalizeHistory(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(Boolean)
    .slice(-7)
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
    }));
}

function readRecentAIChats() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CHAT_STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          (item?.role === "user" ||
            item?.role === "assistant") &&
          String(item?.content || "").trim()
      )
      .slice(-8)
      .map((item) => ({
        role: item.role,
        content: String(item.content).slice(0, 900),
      }));
  } catch {
    return [];
  }
}

function simpleHash(value) {
  let hash = 5381;
  const text = String(value);

  for (let index = 0; index < text.length; index += 1) {
    hash =
      (hash * 33) ^
      text.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function normalizeRecommendation(item, index) {
  if (!item || typeof item !== "object") return null;

  const category = cleanText(
    item.category,
    index % 2 === 0 ? "MOVEMENT" : "RECOVERY"
  ).toUpperCase();

  const title = cleanText(
    item.title,
    "Small wellness reset"
  );

  const duration = cleanText(
    item.duration,
    "10 min"
  );

  const intensity = cleanText(
    item.intensity,
    "Easy"
  );

  const reason = cleanText(
    item.reason,
    "A practical action based on your current WELLsync context."
  );

  const action = cleanText(
    item.action,
    "Keep it comfortable and sustainable."
  );

  return {
    id: `${category}-${title}-${index}`,
    category,
    title,
    duration,
    intensity,
    reason,
    action,
  };
}

function normalizeAIResult(payload) {
  const recommendations = Array.isArray(
    payload?.recommendations
  )
    ? payload.recommendations
        .map(normalizeRecommendation)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  if (recommendations.length < 2) return null;

  return {
    headline: cleanText(
      payload?.headline,
      "Your personalized plan for today"
    ),
    summary: cleanText(
      payload?.summary,
      "Small, practical actions built from your current WELLsync context."
    ),
    recommendations,
  };
}

function extractJSON(text) {
  const raw = String(text || "").trim();

  if (!raw) return null;

  const fenced = raw.match(
    /```(?:json)?\s*([\s\S]*?)```/i
  );

  const candidate = fenced?.[1]?.trim() || raw;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(
      candidate.slice(firstBrace, lastBrace + 1)
    );
  } catch {
    return null;
  }
}

function buildFallback(data, goals, age) {
  if (!data) {
    return {
      headline: "Start with today's check-in",
      summary:
        "Your personalized activity plan unlocks after WELLsync has a current wellness snapshot.",
      recommendations: [
        {
          id: "checkin",
          category: "START",
          title: "Complete your daily check-in",
          duration: "2 min",
          intensity: "Easy",
          reason:
            "WELLsync needs today's signals before it can personalize movement and recovery suggestions.",
          action: "Update your check-in first.",
        },
      ],
    };
  }

  const items = [];

  const sleepGap = Math.max(
    goals.sleep - data.sleep,
    0
  );
  const waterGap = Math.max(
    goals.water - data.water,
    0
  );
  const stepGap = Math.max(
    goals.steps - data.steps,
    0
  );
  const screenGap = Math.max(
    data.screenTime - goals.screenTime,
    0
  );

  if (stepGap > 0) {
    items.push({
      id: "movement-walk",
      category: "MOVEMENT",
      title: "Take a 10–20 minute easy walk",
      duration: "10–20 min",
      intensity: "Easy",
      reason:
        "Your current step count is below your WELLsync movement target.",
      action:
        "Keep the pace comfortable and stop if something hurts.",
    });
  }

  if (data.stress >= 7 || data.energy <= 4) {
    items.push({
      id: "mobility-reset",
      category: "MOBILITY",
      title: "Do a short mobility reset",
      duration: "5–10 min",
      intensity: "Light",
      reason:
        data.stress >= 7
          ? "Your stress signal is elevated today."
          : "Your energy signal is low today, so a lighter movement option fits better.",
      action:
        "Try gentle shoulder, neck, hip and ankle mobility without forcing range.",
    });
  }

  if (sleepGap > 0.5) {
    items.push({
      id: "recovery-winddown",
      category: "RECOVERY",
      title: "Protect a calmer evening",
      duration: "20–30 min",
      intensity: "Very light",
      reason:
        "Your recorded sleep is below the target you set in WELLsync.",
      action:
        "Create a quiet, screen-light period before bed and keep the routine repeatable.",
    });
  }

  if (waterGap > 0) {
    items.push({
      id: "hydration-break",
      category: "HYDRATION",
      title: "Add a simple hydration break",
      duration: "2 min",
      intensity: "Easy",
      reason:
        "Your current hydration count is below today's target.",
      action:
        `Add one practical water break rather than trying to catch up all at once.`,
    });
  }

  if (screenGap > 0) {
    items.push({
      id: "screen-break",
      category: "DIGITAL BALANCE",
      title: "Take a screen-free reset",
      duration: "5–15 min",
      intensity: "Very light",
      reason:
        "Your current screen time is above your WELLsync target.",
      action:
        "Step away from the screen and use the break for a short walk, stretch or quiet reset.",
    });
  }

  const ageGroup = getAgeGroup(age);

  if (!items.length) {
    items.push(
      {
        id: "walk",
        category: "MOVEMENT",
        title: "Take a relaxed outdoor walk",
        duration: "15–20 min",
        intensity: "Easy",
        reason:
          "Your tracked signals are relatively balanced today.",
        action:
          "Use it as enjoyable everyday movement rather than a hard workout.",
      },
      {
        id: "mobility",
        category: "MOBILITY",
        title: "Add a 5-minute mobility break",
        duration: "5 min",
        intensity: "Light",
        reason:
          "A short movement break keeps the day varied without adding a heavy training load.",
        action:
          "Move comfortably through a few gentle, pain-free ranges.",
      }
    );
  }

  if (
    ageGroup === "teen" &&
    !items.some(
      (item) =>
        item.category === "MOVEMENT" ||
        item.category === "MOBILITY"
    )
  ) {
    items.unshift({
      id: "teen-movement",
      category: "MOVEMENT",
      title: "Choose enjoyable everyday movement",
      duration: "10–20 min",
      intensity: "Easy",
      reason:
        "For younger users, WELLsync keeps the plan focused on sustainable, age-appropriate movement.",
      action:
        "Pick a walk, easy cycle, recreational game or another activity you enjoy.",
    });
  }

  return {
    headline:
      items.length >= 3
        ? "A practical rhythm for the rest of today"
        : "A simple plan for today",
    summary:
      "Your plan prioritizes the clearest gaps first and keeps the next actions small enough to repeat.",
    recommendations: items
      .slice(0, 4)
      .map((item, index) =>
        normalizeRecommendation(item, index)
      ),
  };
}

function buildPrompt({
  data,
  goals,
  history,
  age,
  aiChats,
}) {
  const ageGroup = getAgeGroup(age);

  return `
Create today's WELLsync activity and movement recommendations.

Return ONLY valid JSON. Do not wrap it in markdown.

Use this exact structure:
{
  "headline": "short headline",
  "summary": "one short sentence",
  "recommendations": [
    {
      "category": "MOVEMENT | MOBILITY | RECOVERY | HYDRATION | DIGITAL BALANCE | GENERAL",
      "title": "specific activity",
      "duration": "e.g. 10–20 min",
      "intensity": "Easy | Light | Moderate",
      "reason": "specific reason grounded in the supplied data or conversation",
      "action": "one short practical instruction"
    }
  ]
}

Requirements:
- Return 3 or 4 recommendations.
- Prioritize the clearest gaps in today's WELLsync data.
- Use recent history to notice repeated or improving patterns when useful.
- Use recent WELLsync AI conversation context to personalize the recommendations when it is relevant.
- Include at least one movement or mobility recommendation when it is appropriate.
- Keep activities practical, sustainable, and doable today.
- Do not invent symptoms, injuries, equipment, diagnoses, or personal facts.
- Do not prescribe medical treatment.
- Avoid extreme exercise, dangerous challenges, or training through pain.
- Do not make recommendations based on appearance or body comparison.
- For users under 18, keep the plan especially age-appropriate and supportive. Do not include weight-loss targets, calorie-cutting, restrictive dieting, body-composition goals, or extreme training.
- The WELLsync score is a product heuristic, not a medical measurement.
- Use the supplied goals as preferences, not as medical requirements.

AGE PROFILE:
${JSON.stringify({
  age: Number.isInteger(Number(age)) ? Number(age) : null,
  age_group: ageGroup,
})}

CURRENT WELLNESS:
${JSON.stringify(data)}

GOALS:
${JSON.stringify(goals)}

RECENT HISTORY:
${JSON.stringify(normalizeHistory(history))}

RECENT AI CONVERSATION:
${JSON.stringify(aiChats)}
`.trim();
}

async function requestRecommendations({
  data,
  goals,
  history,
  age,
  aiChats,
}) {
  const response = await fetch(
    `${API_URL}/ai/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: buildPrompt({
          data,
          goals,
          history,
          age,
          aiChats,
        }),
        wellness_data: data,
        goals,
        history: normalizeHistory(history),
        device_data: {},
        profile: {
          ...(Number.isInteger(Number(age))
            ? {
                age: Number(age),
                age_group: getAgeGroup(age),
              }
            : {}),
        },
        mode: "trainer",
        web_mode: "personal_data",
        conversation: aiChats,
      }),
      signal: (() => {
        const controller = new AbortController();

        window.setTimeout(
          () => controller.abort(),
          30000
        );

        return controller.signal;
      })(),
    }
  );

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.detail ||
        `Daily recommendations failed (${response.status})`
    );
  }

  const parsed =
    extractJSON(result?.response) ||
    result?.recommendations ||
    result;

  const normalized =
    normalizeAIResult(parsed);

  if (!normalized) {
    throw new Error(
      "The AI response did not contain a usable daily plan."
    );
  }

  return normalized;
}

function categoryIcon(category) {
  const icons = {
    MOVEMENT: "↗",
    MOBILITY: "◌",
    RECOVERY: "◒",
    HYDRATION: "◇",
    "DIGITAL BALANCE": "□",
    GENERAL: "✦",
    START: "✦",
  };

  return icons[category] || "✦";
}

export default function DailyRecommendations({
  data,
  goals,
  history,
  age,
  onNavigate,
}) {
  const normalizedData = useMemo(
    () => normalizeData(data),
    [data]
  );

  const normalizedGoals = useMemo(
    () => normalizeGoals(goals),
    [goals]
  );

  const [aiChats, setAiChats] = useState(
    () => readRecentAIChats()
  );
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const contextKey = useMemo(
    () =>
      simpleHash(
        JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          data: normalizedData,
          goals: normalizedGoals,
          history: normalizeHistory(history),
          age,
          aiChats,
          refreshTick,
        })
      ),
    [
      normalizedData,
      normalizedGoals,
      history,
      age,
      aiChats,
      refreshTick,
    ]
  );

  function refreshAIChats() {
    setAiChats(readRecentAIChats());
  }

  useEffect(() => {
    function handleConversationUpdate() {
      refreshAIChats();
    }

    window.addEventListener(
      "wellsync_ai_conversation_updated",
      handleConversationUpdate
    );

    window.addEventListener(
      "storage",
      handleConversationUpdate
    );

    return () => {
      window.removeEventListener(
        "wellsync_ai_conversation_updated",
        handleConversationUpdate
      );
      window.removeEventListener(
        "storage",
        handleConversationUpdate
      );
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function generate() {
      const fallback = buildFallback(
        normalizedData,
        normalizedGoals,
        age
      );

      if (!normalizedData) {
        setPlan(fallback);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const cacheKey =
        `${CACHE_PREFIX}_${contextKey}`;

      try {
        const cached =
          sessionStorage.getItem(cacheKey);

        if (cached) {
          const parsed = JSON.parse(cached);
          if (mounted) {
            setPlan(parsed);
            setLoading(false);
          }
          return;
        }

        const aiPlan =
          await requestRecommendations({
            data: normalizedData,
            goals: normalizedGoals,
            history,
            age,
            aiChats,
          });

        if (!mounted) return;

        setPlan(aiPlan);

        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify(aiPlan)
          );
        } catch {}
      } catch (requestError) {
        console.info(
          "Daily recommendations unavailable:",
          requestError?.message || requestError
        );

        if (mounted) {
          setPlan(fallback);
          setError(
            "AI plan unavailable — showing a data-based plan."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    generate();

    return () => {
      mounted = false;
    };
  }, [
    normalizedData,
    normalizedGoals,
    history,
    age,
    aiChats,
    contextKey,
  ]);

  function openRecommendationInAI(item) {
    const prompt = `Turn today's WELLsync recommendation "${item.title}" into a simple, age-appropriate step-by-step plan. Use my current wellness context and keep it sustainable.`;

    try {
      sessionStorage.setItem(
        "wellsync_ai_prompt",
        prompt
      );
      sessionStorage.setItem(
        "wellsync_ai_mode",
        item.category === "MOVEMENT" ||
          item.category === "MOBILITY"
          ? "trainer"
          : "recovery"
      );
    } catch {}

    onNavigate?.("ai");
  }

  if (!data) {
    return (
      <section className="daily-rec-card daily-rec-empty glass-panel">
        <div className="daily-rec-empty-copy">
          <span className="daily-rec-eyebrow">
            DAILY WELLNESS PLAN
          </span>
          <h2>Complete your first check-in to unlock recommendations.</h2>
          <p>
            WELLsync will combine your tracked signals, goals and recent AI
            context into practical activities for the day.
          </p>
          <button
            type="button"
            className="daily-rec-primary"
            onClick={() => onNavigate?.("checkin")}
          >
            Complete check-in →
          </button>
        </div>
      </section>
    );
  }

  const displayPlan =
    plan ||
    buildFallback(
      normalizedData,
      normalizedGoals,
      age
    );

  return (
    <section className="daily-rec-card glass-panel">
      <div className="daily-rec-header">
        <div>
          <div className="daily-rec-eyebrow">
            <span>✦</span> TODAY'S WELLNESS PLAN
          </div>
          <h2>
            {loading
              ? "WELLsync is building your day..."
              : displayPlan.headline}
          </h2>
          <p>{displayPlan.summary}</p>
        </div>

        <div className="daily-rec-header-actions">
          <span className="daily-rec-context">
            <i /> DATA + AI CONTEXT
          </span>
          <button
            type="button"
            className="daily-rec-refresh"
            onClick={() =>
              setRefreshTick(
                (current) => current + 1
              )
            }
            disabled={loading}
            title="Generate a fresh daily plan"
          >
            {loading ? "…" : "↻ Refresh plan"}
          </button>
        </div>
      </div>

      {error && (
        <div className="daily-rec-fallback-note">
          {error}
        </div>
      )}

      <div className="daily-rec-grid">
        {displayPlan.recommendations.map(
          (item) => (
            <article
              className="daily-rec-item"
              key={item.id}
            >
              <div className="daily-rec-item-top">
                <div className="daily-rec-icon">
                  {categoryIcon(item.category)}
                </div>
                <span className="daily-rec-category">
                  {item.category}
                </span>
              </div>

              <h3>{item.title}</h3>

              <div className="daily-rec-meta">
                <span>{item.duration}</span>
                <span>{item.intensity}</span>
              </div>

              <p className="daily-rec-reason">
                {item.reason}
              </p>

              <div className="daily-rec-action">
                <span>DO THIS</span>
                <p>{item.action}</p>
              </div>

              <button
                type="button"
                className="daily-rec-ai-button"
                onClick={() =>
                  openRecommendationInAI(item)
                }
              >
                Plan this with WELLsync AI
                <span>↗</span>
              </button>
            </article>
          )
        )}
      </div>

      <div className="daily-rec-footer">
        <span>
          Personalized from today's check-in, goals, recent history and saved
          WELLsync AI conversation context.
        </span>
        <span>GENERAL WELLNESS GUIDANCE</span>
      </div>
    </section>
  );
}

import { useMemo } from "react";
import { calculateWellnessScore } from "../utils/wellnessScore";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getMoodEmoji(mood) {
  const moodMap = {
    Great: "😄",
    Good: "🙂",
    Okay: "😐",
    Low: "😕",
    Stressed: "😣",
  };

  return moodMap[mood] || "🙂";
}

function getScoreMessage(score) {
  if (score >= 85) {
    return {
      label: "Excellent rhythm",
      text: "Your daily habits are working together really well.",
    };
  }

  if (score >= 70) {
    return {
      label: "Good momentum",
      text: "You're building a healthy routine. A few small improvements can push you further.",
    };
  }

  if (score >= 50) {
    return {
      label: "Room to improve",
      text: "Your routine has a few weak spots. Focus on one habit at a time.",
    };
  }

  return {
    label: "Reset opportunity",
    text: "Today is a good day to reset your routine with a few simple actions.",
  };
}

function getPriority(data) {
  if (!data) {
    return {
      title: "Complete your first check-in",
      description:
        "Tell WELLsync how you slept, moved, hydrated and felt today to unlock personalized insights.",
      icon: "✨",
    };
  }

  const issues = [];

  if (Number(data.sleep) < 7) {
    issues.push({
      title: "Sleep is below your target",
      description:
        "A more consistent sleep window could give your routine a stronger foundation.",
      icon: "🌙",
    });
  }

  if (Number(data.water) < 6) {
    issues.push({
      title: "Hydration could improve",
      description:
        "Try adding another glass of water during your next few hours.",
      icon: "💧",
    });
  }

  if (Number(data.steps) < 6000) {
    issues.push({
      title: "Movement is your next opportunity",
      description:
        "A short walk can help you close the activity gap without changing your whole routine.",
      icon: "🚶",
    });
  }

  if (Number(data.screenTime) > 6) {
    issues.push({
      title: "Screen time is running high",
      description:
        "Consider a short screen-free break to give your mind some recovery time.",
      icon: "📱",
    });
  }

  if (Number(data.stress) > 6) {
    issues.push({
      title: "Stress looks elevated",
      description:
        "Create a small recovery window today: step away, breathe and reset.",
      icon: "🧘",
    });
  }

  return (
    issues[0] || {
      title: "Keep your rhythm going",
      description:
        "Your current habits are looking balanced. Focus on consistency today.",
      icon: "⚡",
    }
  );
}

function MetricCard({ icon, label, value, unit, progress, helper }) {
  return (
    <div className="dashboard-metric-card">
      <div className="dashboard-metric-top">
        <span className="dashboard-metric-icon">{icon}</span>
        <span className="dashboard-metric-label">{label}</span>
      </div>

      <div className="dashboard-metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>

      <div className="dashboard-progress-track">
        <div
          className="dashboard-progress-fill"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>

      <div className="dashboard-metric-helper">{helper}</div>
    </div>
  );
}

export default function Dashboard({
  latestData,
  onNavigate,
  dataSource = "local",
}) {
  const score = useMemo(() => {
    if (!latestData) return 0;

    return calculateWellnessScore(latestData);
  }, [latestData]);

  const scoreMessage = getScoreMessage(score);
  const priority = getPriority(latestData);

  const scoreRingStyle = {
    background: `conic-gradient(
      #7c5cff ${score * 3.6}deg,
      rgba(255,255,255,0.08) ${score * 3.6}deg
    )`,
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">YOUR PERSONAL WELLNESS SPACE</p>

          <h1>
            {getGreeting()}, <span>Kaushik.</span>
          </h1>

          <p className="dashboard-subtitle">
            Understand your habits. Improve your everyday.
          </p>
        </div>

        <div className="dashboard-sync-badge">
          <span className="dashboard-sync-dot" />
          {dataSource === "cloud" ? "Synced with Supabase" : "Saved locally"}
        </div>
      </div>

      {!latestData ? (
        <div className="dashboard-empty-state">
          <div className="dashboard-empty-icon">🌱</div>

          <div>
            <p className="dashboard-card-label">YOUR WELLNESS JOURNEY</p>

            <h2>Start with today's check-in</h2>

            <p>
              WELLsync needs a little information about your day before it can
              understand your patterns.
            </p>

            <button
              className="dashboard-primary-button"
              onClick={() => onNavigate("checkin")}
            >
              Complete Daily Check-In →
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="dashboard-score-card">
            <div className="dashboard-score-left">
              <div className="dashboard-score-ring" style={scoreRingStyle}>
                <div className="dashboard-score-inner">
                  <strong>{score}</strong>
                  <span>/ 100</span>
                </div>
              </div>

              <div className="dashboard-score-copy">
                <p className="dashboard-card-label">TODAY'S WELLNESS SCORE</p>

                <h2>{scoreMessage.label}</h2>

                <p>{scoreMessage.text}</p>

                <button
                  className="dashboard-secondary-button"
                  onClick={() => onNavigate("insights")}
                >
                  View my insights →
                </button>
              </div>
            </div>

            <div className="dashboard-score-side">
              <span className="dashboard-ai-badge">✦ AI-POWERED</span>

              <p>
                Your score combines sleep, hydration, movement, screen time,
                mood, energy and stress into one daily wellness signal.
              </p>

              <button
                className="dashboard-ai-button"
                onClick={() => onNavigate("ai")}
              >
                Ask WELLsync AI →
              </button>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <p className="dashboard-card-label">TODAY AT A GLANCE</p>
                <h2>Your daily signals</h2>
              </div>

              <button
                className="dashboard-text-button"
                onClick={() => onNavigate("checkin")}
              >
                Update check-in →
              </button>
            </div>

            <div className="dashboard-metrics-grid">
              <MetricCard
                icon="🌙"
                label="Sleep"
                value={latestData.sleep}
                unit="h"
                progress={(Number(latestData.sleep) / 8) * 100}
                helper={
                  Number(latestData.sleep) >= 7
                    ? "Within a healthy range"
                    : "Could use more recovery"
                }
              />

              <MetricCard
                icon="💧"
                label="Hydration"
                value={latestData.water}
                unit=" glasses"
                progress={(Number(latestData.water) / 8) * 100}
                helper={
                  Number(latestData.water) >= 6
                    ? "Good hydration rhythm"
                    : "Try drinking a little more"
                }
              />

              <MetricCard
                icon="🚶"
                label="Activity"
                value={latestData.steps.toLocaleString()}
                progress={(Number(latestData.steps) / 8000) * 100}
                helper={
                  Number(latestData.steps) >= 6000
                    ? "Movement is on track"
                    : "A short walk could help"
                }
              />

              <MetricCard
                icon="📱"
                label="Screen time"
                value={latestData.screenTime}
                unit="h"
                progress={Math.max(
                  0,
                  100 - (Number(latestData.screenTime) - 4) * 15
                )}
                helper={
                  Number(latestData.screenTime) <= 6
                    ? "Nice digital balance"
                    : "Consider a screen break"
                }
              />
            </div>
          </section>

          <section className="dashboard-lower-grid">
            <div className="dashboard-priority-card">
              <div className="dashboard-card-header">
                <div>
                  <p className="dashboard-card-label">WELLSYNC SIGNAL</p>
                  <h2>What needs your attention?</h2>
                </div>

                <span className="dashboard-priority-icon">
                  {priority.icon}
                </span>
              </div>

              <h3>{priority.title}</h3>

              <p>{priority.description}</p>

              <button
                className="dashboard-primary-button"
                onClick={() => onNavigate("insights")}
              >
                Explore personalized insights →
              </button>
            </div>

            <div className="dashboard-mood-card">
              <p className="dashboard-card-label">HOW YOU FEEL</p>

              <div className="dashboard-mood-main">
                <span className="dashboard-mood-emoji">
                  {getMoodEmoji(latestData.mood)}
                </span>

                <div>
                  <h2>{latestData.mood}</h2>
                  <p>Your current mood signal</p>
                </div>
              </div>

              <div className="dashboard-mood-row">
                <div>
                  <span>Energy</span>
                  <strong>{latestData.energy}/10</strong>
                </div>

                <div>
                  <span>Stress</span>
                  <strong>{latestData.stress}/10</strong>
                </div>
              </div>

              <button
                className="dashboard-secondary-button"
                onClick={() => onNavigate("ai")}
              >
                Talk to WELLsync AI →
              </button>
            </div>
          </section>

          <section className="dashboard-journey-card">
            <div>
              <p className="dashboard-card-label">YOUR WELLNESS LOOP</p>
              <h2>Track → Analyze → Understand → Act</h2>
              <p>
                Every check-in helps WELLsync understand your personal
                patterns and turn them into practical actions.
              </p>
            </div>

            <div className="dashboard-loop">
              <span>Track</span>
              <b>→</b>
              <span>Analyze</span>
              <b>→</b>
              <span>Understand</span>
              <b>→</b>
              <span>Act</span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
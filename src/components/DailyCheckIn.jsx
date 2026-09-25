import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { saveWellnessData } from "../utils/wellnessData";
import "./DailyCheckIn.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const DEFAULT_DATA = {
  sleep: 7,
  water: 5,
  steps: 6000,
  screenTime: 5,
  mood: "Good",
  energy: 7,
  stress: 4,
};

const MOODS = [
  { value: "Great", label: "Great", icon: "✦", tone: "great" },
  { value: "Good", label: "Good", icon: "◒", tone: "good" },
  { value: "Okay", label: "Okay", icon: "◌", tone: "okay" },
  { value: "Low", label: "Low", icon: "⌁", tone: "low" },
  { value: "Stressed", label: "Stressed", icon: "≈", tone: "stressed" },
];

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function normalize(values) {
  return {
    sleep: Number(values.sleep),
    water: Number(values.water),
    steps: Number(values.steps),
    screenTime: Number(values.screenTime),
    mood: values.mood,
    energy: Number(values.energy),
    stress: Number(values.stress),
  };
}

function getLocalScore(data) {
  const sleep = Math.min(data.sleep / 8, 1) * 100;
  const hydration = Math.min(data.water / 8, 1) * 100;
  const activity = Math.min(data.steps / 8000, 1) * 100;
  const screen =
    data.screenTime <= 4
      ? 100
      : Math.max(0, 100 - (data.screenTime - 4) * 15);
  const mood = {
    Great: 100,
    Good: 85,
    Okay: 65,
    Low: 40,
    Stressed: 25,
  }[data.mood] ?? 65;
  const energy = (data.energy / 10) * 100;
  const stress = Math.max(0, Math.min(100, ((10 - data.stress) / 9) * 100));

  return Math.round(
    sleep * 0.2 +
      hydration * 0.15 +
      activity * 0.2 +
      screen * 0.1 +
      mood * 0.15 +
      energy * 0.1 +
      stress * 0.1
  );
}

function scoreLabel(score) {
  if (score >= 85) return "Strong rhythm";
  if (score >= 70) return "Good momentum";
  if (score >= 50) return "Room to improve";
  return "Reset opportunity";
}

export default function DailyCheckIn({ onNavigate }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [backendOnline, setBackendOnline] = useState(false);
  const [supabaseOnline, setSupabaseOnline] = useState(Boolean(supabase));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkBackend() {
      try {
        const response = await fetch(`${API_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (mounted) setBackendOnline(response.ok);
      } catch {
        if (mounted) setBackendOnline(false);
      }
    }

    checkBackend();

    return () => {
      mounted = false;
    };
  }, []);

  const completion = useMemo(() => {
    let points = 0;
    if (data.sleep > 0) points += 1;
    if (data.water >= 0) points += 1;
    if (data.steps >= 0) points += 1;
    if (data.screenTime >= 0) points += 1;
    if (data.mood) points += 1;
    if (data.energy > 0) points += 1;
    if (data.stress > 0) points += 1;
    return Math.round((points / 7) * 100);
  }, [data]);

  function update(key, value) {
    setData((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError("");
  }

  async function saveToCloud(values) {
    if (!supabase) return false;

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!userData?.user) return false;

    const today = new Date().toISOString().split("T")[0];

    const { error: insertError } = await supabase
      .from("checkins")
      .upsert(
        {
          user_id: userData.user.id,
          date: today,
          sleep: values.sleep,
          water: values.water,
          steps: values.steps,
          screen_time: values.screenTime,
          mood: values.mood,
          energy: values.energy,
          stress: values.stress,
        },
        { onConflict: "user_id,date" }
      );

    if (insertError) throw insertError;
    return true;
  }

  async function submitCheckIn(event) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setResult(null);

    const values = normalize(data);

    try {
      let score = getLocalScore(values);

      try {
        const response = await fetch(`${API_URL}/wellness/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const payload = await response.json();
          if (Number.isFinite(Number(payload?.score))) {
            score = Math.round(Number(payload.score));
          }
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }

      saveWellnessData(values);

      let cloudSaved = false;

      try {
        cloudSaved = await saveToCloud(values);
        setSupabaseOnline(Boolean(cloudSaved || supabase));
      } catch (cloudError) {
        console.info("Cloud check-in unavailable:", cloudError?.message);
        setSupabaseOnline(false);
      }

      setResult({
        score,
        label: scoreLabel(score),
        cloudSaved,
      });
    } catch (submitError) {
      console.error("Check-in submission failed:", submitError);
      setError(
        submitError?.message ||
          "Your check-in could not be saved right now."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="checkin-page">
      <header className="checkin-hero">
        <div>
          <span className="checkin-kicker">DAILY CHECK-IN</span>
          <h1>How are you <em>feeling today?</em></h1>
          <p>
            A few quick signals help WELLsync understand your routine and turn
            today's inputs into a clearer wellness picture.
          </p>
        </div>

        <div className="checkin-progress-card">
          <div className="checkin-progress-ring" style={{ "--progress": `${completion}%` }}>
            <strong>{completion}%</strong>
          </div>
          <div>
            <span>CHECK-IN</span>
            <strong>{completion === 100 ? "Complete" : "In progress"}</strong>
            <small>7 everyday signals</small>
          </div>
        </div>
      </header>

      <div className="checkin-status-row">
        <div className={`checkin-status ${backendOnline ? "online" : ""}`}>
          <i />
          {backendOnline ? "Python backend online" : "Python backend unavailable"}
        </div>
        <div className={`checkin-status ${supabaseOnline ? "online" : ""}`}>
          <i />
          {supabaseOnline ? "Supabase connected" : "Cloud sync unavailable"}
        </div>
      </div>

      {error && (
        <div className="checkin-alert error">
          <span>!</span>
          {error}
        </div>
      )}

      <form className="checkin-form" onSubmit={submitCheckIn}>
        <section className="checkin-card">
          <div className="checkin-card-head">
            <div>
              <span className="checkin-eyebrow">01 · RECOVERY</span>
              <h2>How much did you sleep?</h2>
              <p>Log the amount of sleep you got before starting today.</p>
            </div>
            <div className="checkin-icon">◒</div>
          </div>

          <div className="checkin-value-line">
            <strong>{data.sleep.toFixed(1)}</strong>
            <span>hours</span>
            <small>Typical target · 7–9h</small>
          </div>

          <input
            className="checkin-range"
            type="range"
            min="0"
            max="12"
            step="0.5"
            value={data.sleep}
            onChange={(event) => update("sleep", Number(event.target.value))}
            style={{ "--range-progress": `${(data.sleep / 12) * 100}%` }}
          />

          <div className="checkin-scale"><span>0h</span><span>12h</span></div>
        </section>

        <section className="checkin-card">
          <div className="checkin-card-head">
            <div>
              <span className="checkin-eyebrow">02 · HYDRATION</span>
              <h2>How much water did you drink?</h2>
              <p>Track your approximate intake for today.</p>
            </div>
            <div className="checkin-icon cyan">◇</div>
          </div>

          <div className="checkin-value-line">
            <strong>{data.water}</strong>
            <span>glasses</span>
            <small>WELLsync goal · 6 glasses</small>
          </div>

          <input
            className="checkin-range cyan"
            type="range"
            min="0"
            max="12"
            step="1"
            value={data.water}
            onChange={(event) => update("water", Number(event.target.value))}
            style={{ "--range-progress": `${(data.water / 12) * 100}%` }}
          />

          <div className="checkin-scale"><span>0</span><span>12 glasses</span></div>
        </section>

        <section className="checkin-card">
          <div className="checkin-card-head">
            <div>
              <span className="checkin-eyebrow">03 · MOVEMENT</span>
              <h2>How active were you?</h2>
              <p>Enter your approximate steps for today.</p>
            </div>
            <div className="checkin-icon green">↗</div>
          </div>

          <div className="checkin-value-line">
            <strong>{data.steps.toLocaleString("en-IN")}</strong>
            <span>steps</span>
            <small>WELLsync goal · {"6,000"}</small>
          </div>

          <input
            className="checkin-range green"
            type="range"
            min="0"
            max="15000"
            step="250"
            value={data.steps}
            onChange={(event) => update("steps", Number(event.target.value))}
            style={{ "--range-progress": `${(data.steps / 15000) * 100}%` }}
          />

          <div className="checkin-scale"><span>0</span><span>15,000 steps</span></div>
        </section>

        <section className="checkin-card">
          <div className="checkin-card-head">
            <div>
              <span className="checkin-eyebrow">04 · DIGITAL BALANCE</span>
              <h2>How much screen time did you have?</h2>
              <p>Use the day so far if the day is still in progress.</p>
            </div>
            <div className="checkin-icon orange">▣</div>
          </div>

          <div className="checkin-value-line">
            <strong>{data.screenTime.toFixed(1)}</strong>
            <span>hours</span>
            <small>Target · ≤ 6h</small>
          </div>

          <input
            className="checkin-range orange"
            type="range"
            min="0"
            max="12"
            step="0.5"
            value={data.screenTime}
            onChange={(event) => update("screenTime", Number(event.target.value))}
            style={{ "--range-progress": `${(data.screenTime / 12) * 100}%` }}
          />

          <div className="checkin-scale"><span>0h</span><span>12h</span></div>
        </section>

        <section className="checkin-card">
          <div className="checkin-card-head">
            <div>
              <span className="checkin-eyebrow">05 · MOOD</span>
              <h2>How does today feel?</h2>
              <p>Choose the mood that best fits your day right now.</p>
            </div>
            <div className="checkin-icon pink">✦</div>
          </div>

          <div className="mood-grid">
            {MOODS.map((mood) => (
              <button
                type="button"
                key={mood.value}
                className={`mood-option mood-${mood.tone} ${
                  data.mood === mood.value ? "selected" : ""
                }`}
                onClick={() => update("mood", mood.value)}
              >
                <span>{mood.icon}</span>
                <strong>{mood.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="checkin-two-col">
          <div className="checkin-card">
            <div className="checkin-card-head compact">
              <div>
                <span className="checkin-eyebrow">06 · ENERGY</span>
                <h2>What is your energy level?</h2>
                <p>Think about your current capacity, not a perfect day.</p>
              </div>
              <div className="checkin-icon pink">⚡</div>
            </div>

            <div className="checkin-value-line">
              <strong>{data.energy}</strong>
              <span>/10</span>
            </div>

            <input
              className="checkin-range pink"
              type="range"
              min="1"
              max="10"
              step="1"
              value={data.energy}
              onChange={(event) => update("energy", Number(event.target.value))}
              style={{ "--range-progress": `${((data.energy - 1) / 9) * 100}%` }}
            />

            <div className="checkin-scale"><span>Low</span><span>High</span></div>
          </div>

          <div className="checkin-card">
            <div className="checkin-card-head compact">
              <div>
                <span className="checkin-eyebrow">07 · STRESS</span>
                <h2>How stressed do you feel?</h2>
                <p>Use the scale that best matches your current experience.</p>
              </div>
              <div className="checkin-icon rose">≈</div>
            </div>

            <div className="checkin-value-line">
              <strong>{data.stress}</strong>
              <span>/10</span>
            </div>

            <input
              className="checkin-range rose"
              type="range"
              min="1"
              max="10"
              step="1"
              value={data.stress}
              onChange={(event) => update("stress", Number(event.target.value))}
              style={{ "--range-progress": `${((data.stress - 1) / 9) * 100}%` }}
            />

            <div className="checkin-scale"><span>Calm</span><span>High stress</span></div>
          </div>
        </section>

        <section className="checkin-submit-card">
          <div>
            <span className="checkin-eyebrow">READY?</span>
            <h2>Turn today's signals into a clearer picture.</h2>
            <p>
              WELLsync will calculate your prototype wellness signal, save the
              check-in locally, and sync it to your account when cloud storage
              is available.
            </p>
          </div>

          <button className="checkin-submit" type="submit" disabled={submitting}>
            <span>{submitting ? "Saving your check-in…" : "Save today's check-in"}</span>
            <b>→</b>
          </button>
        </section>
      </form>

      {result && (
        <section className="checkin-result">
          <div className="result-ring" style={{ "--result-progress": `${result.score}%` }}>
            <div>
              <span>WELLNESS</span>
              <strong>{result.score}</strong>
              <small>/100</small>
            </div>
          </div>

          <div className="result-copy">
            <span className="checkin-eyebrow">CHECK-IN SAVED</span>
            <h2>{result.label}</h2>
            <p>
              Your latest signals have been captured. Use the rest of WELLsync
              to understand the pattern and decide what to focus on next.
            </p>
            <div className="result-actions">
              <button type="button" onClick={() => onNavigate?.("insights")}>
                Explore insights <span>↗</span>
              </button>
              <button type="button" onClick={() => onNavigate?.("ai")}>
                Ask WELLsync AI <span>↗</span>
              </button>
              <small>{result.cloudSaved ? "Synced to your account" : "Saved locally on this device"}</small>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

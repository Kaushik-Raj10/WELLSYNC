import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getGoals, saveGoals, getWellnessData } from "../utils/wellnessData";
import { saveCloudGoals } from "../utils/supabaseData";
import "./Profile.css";

const PROFILE_PREFS_KEY = "wellsync_profile_preferences";

const DEFAULT_PREFS = {
  coachingStyle: "Balanced",
  responseStyle: "Concise",
  webResearch: "Auto",
};

function getInitials(name, email) {
  const source = String(name || "").trim() || String(email || "").split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function readLocalPrefs() {
  try {
    const stored = localStorage.getItem(PROFILE_PREFS_KEY);
    if (!stored) return DEFAULT_PREFS;

    return {
      ...DEFAULT_PREFS,
      ...JSON.parse(stored),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function metricLabel(key) {
  return {
    sleep: "Sleep",
    water: "Hydration",
    steps: "Movement",
    screenTime: "Screen time",
  }[key] || key;
}

export default function Profile({ onNavigate }) {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState(readLocalPrefs);
  const [goals, setGoals] = useState(() => getGoals());
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!supabase) return;

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Could not load profile:", error);
        if (mounted) setError("Your profile could not be loaded.");
        return;
      }

      const currentUser = data?.user;

      if (!mounted || !currentUser) return;

      const metadata = currentUser.user_metadata || {};
      setUser(currentUser);
      setName(metadata.full_name || "");
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(
    () => getInitials(name, user?.email),
    [name, user?.email]
  );

  function updatePref(key, value) {
    setPrefs((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage("");
  }

  async function handleSaveProfile() {
    if (!supabase) return;

    setSavingProfile(true);
    setMessage("");
    setError("");

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
        },
      });

      if (error) throw error;

      setUser(data?.user || user);

      // Preserve the same display name locally for instant UI refreshes.
      try {
        localStorage.setItem(
          "wellsync_profile_name",
          name.trim()
        );
      } catch {}

      setMessage("Profile updated.");
    } catch (saveError) {
      console.error("Profile update failed:", saveError);
      setError(
        saveError?.message ||
          "Profile could not be updated right now."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function handleSavePreferences() {
    setSavingPrefs(true);
    setMessage("");
    setError("");

    try {
      localStorage.setItem(
        PROFILE_PREFS_KEY,
        JSON.stringify(prefs)
      );

      setMessage(
        "AI preferences saved on this device."
      );
    } catch {
      setError(
        "Preferences could not be saved on this device."
      );
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleSaveGoals() {
    setSavingGoals(true);
    setMessage("");
    setError("");

    try {
      const normalized = {
        sleep: Number(goals.sleep),
        water: Number(goals.water),
        steps: Number(goals.steps),
        screenTime: Number(goals.screenTime),
      };

      saveGoals(normalized);

      try {
        await saveCloudGoals(normalized);
      } catch (cloudError) {
        console.info(
          "Cloud goal update unavailable:",
          cloudError?.message || cloudError
        );
      }

      setGoals(normalized);
      setMessage("Wellness targets updated.");
    } catch (saveError) {
      console.error("Goal update failed:", saveError);
      setError("Your targets could not be updated.");
    } finally {
      setSavingGoals(false);
    }
  }

  function clearLocalData() {
    const confirmed = window.confirm(
      "Clear locally stored WELLsync check-in history and goals on this browser? Your Supabase account data will not be deleted."
    );

    if (!confirmed) return;

    try {
      localStorage.removeItem("wellsync_daily_data");
      localStorage.removeItem("wellsync_history");
      localStorage.removeItem("wellsync_goals");
      setGoals(getGoals());
      setMessage("Local wellness data cleared.");
    } catch {
      setError("Local data could not be cleared.");
    }
  }

  async function handleSignOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message || "Could not sign out.");
    }
  }

  const wellnessData = getWellnessData();

  return (
    <div className="profile-page">
      <header className="profile-hero">
        <div className="profile-hero-copy">
          <span className="profile-kicker">PERSONAL CONTROL CENTER</span>
          <h1>Your profile, <em>your WELLsync.</em></h1>
          <p>
            Manage your identity, wellness targets and how the AI experience
            should feel. Your settings stay connected to the account you use
            across WELLsync.
          </p>
        </div>

        <div className="profile-identity-card">
          <div className="profile-avatar-large">{initials}</div>
          <div>
            <strong>{name || "WELLsync user"}</strong>
            <span>{user?.email || "Account email"}</span>
          </div>
        </div>
      </header>

      {message && (
        <div className="profile-toast profile-toast-success">
          ✓ {message}
        </div>
      )}

      {error && (
        <div className="profile-toast profile-toast-error">
          {error}
        </div>
      )}

      <section className="profile-grid">
        <article className="profile-card">
          <div className="profile-card-eyebrow">ACCOUNT</div>
          <h2>Identity</h2>
          <p className="profile-card-subtitle">
            Keep the details WELLsync uses to personalize the experience.
          </p>

          <div className="profile-field">
            <label htmlFor="profile-name">Display name</label>
            <input
              id="profile-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setMessage("");
              }}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div className="profile-field">
            <label>Email</label>
            <div className="profile-readonly">
              <span>{user?.email || "—"}</span>
              <small>From Supabase Auth</small>
            </div>
          </div>

          <button
            type="button"
            className="profile-primary-button"
            disabled={savingProfile}
            onClick={handleSaveProfile}
          >
            {savingProfile ? "Saving…" : "Save profile"}
            <span>→</span>
          </button>
        </article>

        <article className="profile-card profile-highlight-card">
          <div className="profile-card-eyebrow">WELLSYNC CONTEXT</div>
          <h2>What your account is using</h2>
          <p className="profile-card-subtitle">
            This snapshot shows the everyday signals currently available to
            the product. It is not a medical record.
          </p>

          <div className="profile-context-list">
            {[
              ["Sleep", wellnessData?.sleep, "h"],
              ["Hydration", wellnessData?.water, "glasses"],
              ["Movement", wellnessData?.steps?.toLocaleString("en-IN"), "steps"],
              ["Screen time", wellnessData?.screenTime, "h"],
              ["Energy", wellnessData?.energy, "/10"],
              ["Stress", wellnessData?.stress, "/10"],
            ].map(([label, value, unit]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {value ?? "—"} <small>{unit}</small>
                </strong>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="profile-text-button"
            onClick={() => onNavigate?.("ai")}
          >
            Ask WELLsync what it knows <span>↗</span>
          </button>
        </article>

        <article className="profile-card profile-wide-card">
          <div className="profile-card-head">
            <div>
              <div className="profile-card-eyebrow">AI PERSONALIZATION</div>
              <h2>Make the coach feel like yours.</h2>
              <p className="profile-card-subtitle">
                These preferences guide the interface and are designed to shape
                the AI experience without changing your underlying wellness data.
              </p>
            </div>

            <div className="profile-ai-orb">✦</div>
          </div>

          <div className="profile-preference-grid">
            <label className="profile-select-card">
              <span>Coaching style</span>
              <strong>How should WELLsync talk?</strong>
              <select
                value={prefs.coachingStyle}
                onChange={(event) =>
                  updatePref("coachingStyle", event.target.value)
                }
              >
                <option>Balanced</option>
                <option>Encouraging</option>
                <option>Direct</option>
                <option>Analytical</option>
              </select>
            </label>

            <label className="profile-select-card">
              <span>Response style</span>
              <strong>How much detail should it use?</strong>
              <select
                value={prefs.responseStyle}
                onChange={(event) =>
                  updatePref("responseStyle", event.target.value)
                }
              >
                <option>Concise</option>
                <option>Balanced</option>
                <option>Detailed</option>
              </select>
            </label>

            <label className="profile-select-card">
              <span>Web research</span>
              <strong>When should live web research happen?</strong>
              <select
                value={prefs.webResearch}
                onChange={(event) =>
                  updatePref("webResearch", event.target.value)
                }
              >
                <option>Auto</option>
                <option>Live Web</option>
                <option>Personal Data</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className="profile-secondary-button"
            disabled={savingPrefs}
            onClick={handleSavePreferences}
          >
            {savingPrefs ? "Saving…" : "Save AI preferences"}
          </button>
        </article>

        <article className="profile-card profile-wide-card">
          <div className="profile-card-head">
            <div>
              <div className="profile-card-eyebrow">WELLNESS TARGETS</div>
              <h2>Keep your goals in one place.</h2>
              <p className="profile-card-subtitle">
                The same targets are used by your Dashboard, Goals page and AI
                context.
              </p>
            </div>

            <button
              type="button"
              className="profile-text-button"
              onClick={() => onNavigate?.("goals")}
            >
              Open Goals <span>↗</span>
            </button>
          </div>

          <div className="profile-goal-editor">
            {["sleep", "water", "steps", "screenTime"].map((key) => (
              <label key={key}>
                <span>{metricLabel(key)}</span>
                <div>
                  <input
                    type="number"
                    min={key === "steps" ? 1000 : 0}
                    max={key === "steps" ? 50000 : 24}
                    step={key === "steps" ? 500 : 0.5}
                    value={goals[key]}
                    onChange={(event) =>
                      setGoals((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                  <small>
                    {key === "sleep"
                      ? "hours"
                      : key === "water"
                        ? "glasses"
                        : key === "steps"
                          ? "steps"
                          : "hours max"}
                  </small>
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="profile-primary-button"
            disabled={savingGoals}
            onClick={handleSaveGoals}
          >
            {savingGoals ? "Saving…" : "Save wellness targets"}
            <span>→</span>
          </button>
        </article>

        <article className="profile-card profile-privacy-card">
          <div className="profile-card-eyebrow">PRIVACY & DATA</div>
          <h2>Stay in control.</h2>
          <p className="profile-card-subtitle">
            WELLsync separates your local browser data from your authenticated
            cloud account. These controls affect only the browser-side data.
          </p>

          <div className="profile-data-actions">
            <button
              type="button"
              className="profile-danger-button"
              onClick={clearLocalData}
            >
              Clear local wellness data
            </button>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </article>
      </section>

      <section className="profile-footer">
        <div>
          <span>WELLsync</span>
          <strong>Track → Analyze → Understand → Act</strong>
        </div>
        <button type="button" onClick={() => onNavigate?.("dashboard")}>
          Back to dashboard <span>↗</span>
        </button>
      </section>
    </div>
  );
}

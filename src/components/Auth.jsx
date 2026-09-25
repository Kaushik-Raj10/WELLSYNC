import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Auth.css";

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0] || "W").slice(0, 2).toUpperCase();
}

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const isSignUp = mode === "signup";

  const title = useMemo(
    () => (isSignUp ? "Create your wellness space." : "Welcome back."),
    [isSignUp]
  );

  function switchMode(nextMode) {
    setMode(nextMode);
    setNotice("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setNotice("");
    setError("");

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (isSignUp && !cleanName) {
      setError("Enter your name to create your WELLsync account.");
      return;
    }

    if (password.length < 6) {
      setError("Your password should be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data?.session) {
          setNotice("Account created. Opening your wellness space…");
        } else {
          setNotice(
            "Account created. Check your email if verification is required, then sign in."
          );
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (signInError) throw signInError;

        setNotice("Signed in. Opening your wellness space…");
      }
    } catch (authError) {
      console.error("Authentication error:", authError);

      const message = String(authError?.message || "");

      if (message.toLowerCase().includes("invalid login credentials")) {
        setError("The email or password is incorrect.");
      } else if (message.toLowerCase().includes("user already registered")) {
        setError("That email already has a WELLsync account. Sign in instead.");
      } else if (message) {
        setError(message);
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-scene" aria-hidden="true">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />
        <div className="auth-stars">
          {Array.from({ length: 22 }).map((_, index) => (
            <span
              key={index}
              style={{
                left: `${8 + ((index * 37) % 88)}%`,
                top: `${5 + ((index * 19) % 60)}%`,
                animationDelay: `${(index % 7) * 0.7}s`,
                animationDuration: `${4 + (index % 5)}s`,
              }}
            />
          ))}
        </div>
      </div>

      <section className="auth-shell">
        <aside className="auth-visual-panel">
          <div className="auth-brand">
            <div className="auth-brand-mark">
              <span>W</span>
            </div>
            <div>
              <strong>WELLsync</strong>
              <small>Personal Wellness Intelligence</small>
            </div>
          </div>

          <div className="auth-visual-content">
            <span className="auth-kicker">YOUR DAILY WELLNESS COMPANION</span>
            <h1>
              Understand your habits.
              <em>Improve your everyday.</em>
            </h1>

            <p>
              Bring sleep, hydration, movement, screen time, mood, energy and
              stress into one calm, personalized experience.
            </p>

            <div className="auth-loop">
              {[
                ["01", "Track", "Capture everyday signals."],
                ["02", "Analyze", "Find useful patterns."],
                ["03", "Understand", "See what matters."],
                ["04", "Act", "Take the next step."],
              ].map(([number, label, description]) => (
                <div className="auth-loop-item" key={number}>
                  <span>{number}</span>
                  <div>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-visual-footer">
            <span>WELLsync</span>
            <small>General wellness guidance · Not a medical diagnosis service</small>
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="auth-mobile-brand">
            <div className="auth-brand-mark">
              <span>W</span>
            </div>
            <div>
              <strong>WELLsync</strong>
              <small>Personal Wellness</small>
            </div>
          </div>

          <div className="auth-form-heading">
            <span className="auth-kicker">
              {isSignUp ? "GET STARTED" : "WELCOME BACK"}
            </span>
            <h2>{title}</h2>
            <p>
              {isSignUp
                ? "Create your account and start building a clearer picture of your everyday wellness."
                : "Sign in to continue tracking your everyday wellness."}
            </p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={!isSignUp ? "active" : ""}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={isSignUp ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="auth-message auth-message-error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          {notice && (
            <div className="auth-message auth-message-success" role="status">
              <span>✓</span>
              {notice}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <label className="auth-field">
                <span>Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading
                ? isSignUp
                  ? "Creating account…"
                  : "Signing in…"
                : isSignUp
                  ? "Create my WELLsync account"
                  : "Sign in to WELLsync"}
              <span>→</span>
            </button>
          </form>

          <div className="auth-support">
            <div className="auth-support-icon">✦</div>
            <div>
              <strong>Built around your context.</strong>
              <p>
                Your authenticated account keeps your WELLsync experience
                connected across check-ins, goals, insights and AI.
              </p>
            </div>
          </div>

          <p className="auth-switch-copy">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              type="button"
              onClick={() =>
                switchMode(isSignUp ? "signin" : "signup")
              }
            >
              {isSignUp ? "Sign in" : "Create one"}
            </button>
          </p>
        </section>
      </section>
    </main>
  );
}

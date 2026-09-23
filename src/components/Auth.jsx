import { useState } from "react";
import { supabase } from "../lib/supabase";

function Auth() {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isLogin = mode === "login";

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    if (!isLogin && !name.trim()) {
      setError("Please enter your name.");
      setLoading(false);
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) {
          throw loginError;
        }

        setMessage("Login successful. Loading WELLsync...");
      } else {
        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          });

        if (signupError) {
          throw signupError;
        }

        if (data.session) {
          setMessage("Account created. Loading WELLsync...");
        } else {
          setMessage(
            "Account created. Check your email to confirm your account, then sign in."
          );
        }
      }
    } catch (authError) {
      console.error("Supabase Auth error:", authError);

      setError(
        authError?.message ||
          "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isLogin ? "signup" : "login");
    setMessage("");
    setError("");
    setName("");
  };

  return (
    <div className="auth-page">

      <div className="auth-background-glow"></div>

      <div className="auth-card">

        <div className="auth-brand">
          <div className="auth-brand-mark">✦</div>

          <div>
            <strong>WELLsync</strong>
            <small>Personal Wellness</small>
          </div>
        </div>

        <div className="auth-header">
          <p className="greeting">
            {isLogin ? "WELCOME BACK" : "GET STARTED"}
          </p>

          <h1>
            {isLogin
              ? "Welcome back."
              : "Build your wellness routine."}
          </h1>

          <p>
            {isLogin
              ? "Sign in to continue tracking your everyday wellness."
              : "Create your account and start building your personal wellness history."}
          </p>
        </div>

        <div className="auth-tabs">

          <button
            type="button"
            className={isLogin ? "active" : ""}
            onClick={() => {
              setMode("login");
              setMessage("");
              setError("");
            }}
          >
            Sign In
          </button>

          <button
            type="button"
            className={!isLogin ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setMessage("");
              setError("");
            }}
          >
            Create Account
          </button>

        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          {!isLogin && (
            <label>
              Name

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                autoComplete="name"
                disabled={loading}
              />
            </label>
          )}

          <label>
            Email

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              disabled={loading}
            />
          </label>

          <label>
            Password

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete={
                isLogin
                  ? "current-password"
                  : "new-password"
              }
              disabled={loading}
            />
          </label>

          {error && (
            <div className="auth-message auth-error">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-message auth-success">
              {message}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isLogin
              ? "Sign in to WELLsync →"
              : "Create my WELLsync account →"}
          </button>

        </form>

        <div className="auth-switch">

          <span>
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>

          <button
            type="button"
            onClick={switchMode}
          >
            {isLogin
              ? "Create one"
              : "Sign in"}
          </button>

        </div>

        <div className="auth-note">
          <span>ⓘ</span>

          <p>
            WELLsync stores your wellness information
            under your authenticated account.
          </p>
        </div>

      </div>
    </div>
  );
}

export default Auth;
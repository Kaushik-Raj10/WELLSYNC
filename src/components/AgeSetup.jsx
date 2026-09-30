import { useState } from "react";
import { supabase } from "../lib/supabase";
import { isValidAge } from "../utils/ageUtils";
import "./AgeSetup.css";

export default function AgeSetup({ user, onComplete }) {
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!isValidAge(age)) {
      setError("Enter a valid age between 13 and 120.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: updateError } =
        await supabase.auth.updateUser({
          data: {
            ...(user?.user_metadata || {}),
            age: Number(age),
          },
        });

      if (updateError) throw updateError;
      onComplete?.(data?.user || null);
    } catch (updateError) {
      setError(
        updateError?.message ||
          "Could not save your age. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="age-setup-page">
      <section className="age-setup-card">
        <div className="age-setup-mark">W</div>
        <span className="age-setup-kicker">PERSONALIZE WELLSYNC</span>
        <h1>Tell us your age.</h1>
        <p>
          WELLsync uses your age to keep explanations and AI wellness guidance
          appropriate to your life stage.
        </p>

        {error && (
          <div className="age-setup-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            <span>Age</span>
            <div className="age-setup-input-wrap">
              <input
                type="number"
                min="13"
                max="120"
                step="1"
                inputMode="numeric"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="Enter your age"
                autoFocus
              />
              <small>years</small>
            </div>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Continue to WELLsync"}
            <span>→</span>
          </button>
        </form>

        <small className="age-setup-note">
          General wellness guidance only · not a medical diagnosis service.
        </small>
      </section>
    </main>
  );
}

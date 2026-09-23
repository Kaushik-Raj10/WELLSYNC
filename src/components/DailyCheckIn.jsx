import { useEffect, useState } from "react";

import {
  calculateWellnessScore,
} from "../utils/wellnessScore";

import {
  saveWellnessData,
  getWellnessData,
} from "../utils/wellnessData";

import {
  supabase,
} from "../lib/supabase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function getLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function DailyCheckIn() {
  const savedData = getWellnessData();

  const [sleep, setSleep] = useState(
    savedData.sleep
  );

  const [water, setWater] = useState(
    savedData.water
  );

  const [steps, setSteps] = useState(
    savedData.steps
  );

  const [screenTime, setScreenTime] =
    useState(savedData.screenTime);

  const [mood, setMood] = useState(
    savedData.mood
  );

  const [energy, setEnergy] = useState(
    savedData.energy
  );

  const [stress, setStress] = useState(
    savedData.stress
  );

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState("");

  const [saveError, setSaveError] =
    useState(false);

  const [isBackendOnline, setIsBackendOnline] =
    useState(false);

  const [backendChecking, setBackendChecking] =
    useState(true);

  const [backendScore, setBackendScore] =
    useState(null);

  const [supabaseSaving, setSupabaseSaving] =
    useState(false);

  /*
   * -------------------------------------------------------
   * CHECK PYTHON BACKEND
   * -------------------------------------------------------
   */

  const checkBackend = async () => {
    setBackendChecking(true);

    try {
      const response = await fetch(
        `${API_URL}/health`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Python health check failed"
        );
      }

      const result =
        await response.json();

      setIsBackendOnline(
        result.status === "healthy"
      );
    } catch (error) {
      console.error(
        "Python backend connection error:",
        error
      );

      setIsBackendOnline(false);
    } finally {
      setBackendChecking(false);
    }
  };

  useEffect(() => {
    checkBackend();

    const interval =
      setInterval(checkBackend, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * -------------------------------------------------------
   * LIVE SCORE
   * -------------------------------------------------------
   */

  const getCurrentScore = () => {
    return calculateWellnessScore({
      sleep,
      water,
      steps,
      screenTime,
      mood,
      energy,
      stress,
    });
  };

  /*
   * -------------------------------------------------------
   * SAVE TO SUPABASE
   * -------------------------------------------------------
   */

  const saveToSupabase = async (
    wellnessData
  ) => {
    if (!supabase) {
      throw new Error(
        "Supabase is not configured."
      );
    }

    const {
      data: userData,
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const user = userData?.user;

    if (!user) {
      throw new Error(
        "No authenticated Supabase user found."
      );
    }

    const checkinDate = getLocalDate();

    const row = {
      user_id: user.id,
      date: checkinDate,

      sleep: Number(
        wellnessData.sleep
      ),

      water: Number(
        wellnessData.water
      ),

      steps: Number(
        wellnessData.steps
      ),

      screen_time: Number(
        wellnessData.screenTime
      ),

      mood: wellnessData.mood,

      energy: Number(
        wellnessData.energy
      ),

      stress: Number(
        wellnessData.stress
      ),
    };

    setSupabaseSaving(true);

    const {
      error: upsertError,
    } =
      await supabase
        .from("checkins")
        .upsert(
          row,
          {
            onConflict:
              "user_id,date",
          }
        );

    setSupabaseSaving(false);

    if (upsertError) {
      throw upsertError;
    }
  };

  /*
   * -------------------------------------------------------
   * SUBMIT CHECK-IN
   * -------------------------------------------------------
   */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (isSaving) return;

    setIsSaving(true);
    setSaveMessage("");
    setSaveError(false);

    const wellnessData = {
      sleep: Number(sleep),
      water: Number(water),
      steps: Number(steps),
      screenTime: Number(screenTime),
      mood,
      energy: Number(energy),
      stress,
    };

    try {
      /*
       * STEP 1
       * Send data to Python
       */

      const response = await fetch(
        `${API_URL}/wellness/score`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            wellnessData
          ),
        }
      );

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          errorData?.detail ||
            `Python returned ${response.status}`
        );
      }

      const result =
        await response.json();

      setIsBackendOnline(true);

      setBackendScore(
        result.score
      );

      /*
       * STEP 2
       * Save locally as a backup
       */

      saveWellnessData(
        wellnessData
      );

      /*
       * STEP 3
       * Save to Supabase
       */

      await saveToSupabase(
        wellnessData
      );

      /*
       * STEP 4
       * Success
       */

      setSaveMessage(
        `Check-in saved! Python calculated ${result.score}/100 and your data was synced to Supabase.`
      );

    } catch (error) {
      console.error(
        "Daily Check-In error:",
        error
      );

      setSaveError(true);

      /*
       * If Python works but Supabase fails,
       * tell the user specifically.
       */

      if (
        error?.message?.includes(
          "Supabase"
        ) ||
        error?.message?.includes(
          "authenticated"
        ) ||
        error?.message?.includes(
          "checkins"
        ) ||
        error?.code
      ) {
        setSaveMessage(
          `Python processed your score, but Supabase sync failed: ${error.message}`
        );
      } else {
        await checkBackend();

        setSaveMessage(
          "The check-in could not be processed. Check the Python terminal and Supabase configuration."
        );
      }
    } finally {
      setIsSaving(false);
      setSupabaseSaving(false);
    }
  };

  return (
    <div className="checkin-page">

      {/* HEADER */}

      <div className="checkin-header">

        <p className="greeting">
          DAILY CHECK-IN
        </p>

        <h1>
          How are you feeling today?
        </h1>

        <p className="subtitle">
          A few quick questions help WELLsync
          understand your routine.
        </p>

        {/* PYTHON STATUS */}

        <div
          style={{
            display:
              "inline-flex",

            alignItems:
              "center",

            gap: "8px",

            marginTop:
              "14px",

            padding:
              "8px 11px",

            borderRadius:
              "10px",

            background:
              backendChecking
                ? "rgba(255,255,255,0.04)"
                : isBackendOnline
                ? "rgba(114,224,163,0.08)"
                : "rgba(255,123,123,0.08)",

            border:
              backendChecking
                ? "1px solid rgba(255,255,255,0.08)"
                : isBackendOnline
                ? "1px solid rgba(114,224,163,0.18)"
                : "1px solid rgba(255,123,123,0.18)",

            color:
              backendChecking
                ? "rgba(255,255,255,0.5)"
                : isBackendOnline
                ? "#72e0a3"
                : "#ff8b8b",

            fontSize:
              "10px",

            fontWeight:
              "700",
          }}
        >
          <span>
            ●
          </span>

          {backendChecking
            ? "Checking Python..."
            : isBackendOnline
            ? "Python backend online"
            : "Python backend offline"}

          {!isBackendOnline &&
            !backendChecking && (
              <button
                type="button"
                onClick={
                  checkBackend
                }
                style={{
                  marginLeft:
                    "4px",

                  padding:
                    "4px 7px",

                  borderRadius:
                    "7px",

                  background:
                    "rgba(255,255,255,0.06)",

                  color:
                    "#ffffff",

                  fontSize:
                    "9px",

                  cursor:
                    "pointer",
                }}
              >
                Retry
              </button>
            )}
        </div>

        {/* SUPABASE STATUS */}

        <div
          style={{
            display:
              "inline-flex",

            alignItems:
              "center",

            gap: "8px",

            marginTop:
              "8px",

            marginLeft:
              "8px",

            padding:
              "8px 11px",

            borderRadius:
              "10px",

            background:
              "rgba(80,220,150,0.06)",

            border:
              "1px solid rgba(80,220,150,0.12)",

            color:
              "#72e0a3",

            fontSize:
              "10px",

            fontWeight:
              "700",
          }}
        >
          <span>
            ●
          </span>

          Supabase connected
        </div>

      </div>

      <form
        className="checkin-form"
        onSubmit={
          handleSubmit
        }
      >

        {/* SLEEP */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              😴
            </span>

            <div>
              <h3>
                How much did you sleep?
              </h3>

              <p>
                Recommended: around 7–9 hours
                for most adults.
              </p>
            </div>

            <strong>
              {sleep} hrs
            </strong>

          </div>

          <input
            type="range"
            min="0"
            max="12"
            step="0.5"
            value={sleep}
            onChange={(e) =>
              setSleep(
                e.target.value
              )
            }
          />

          <div className="range-labels">
            <span>
              0 hrs
            </span>

            <span>
              12 hrs
            </span>
          </div>

        </div>

        {/* WATER */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              💧
            </span>

            <div>
              <h3>
                How much water did you drink?
              </h3>

              <p>
                Track your approximate intake
                for today.
              </p>
            </div>

            <strong>
              {water} glasses
            </strong>

          </div>

          <input
            type="range"
            min="0"
            max="12"
            value={water}
            onChange={(e) =>
              setWater(
                e.target.value
              )
            }
          />

          <div className="range-labels">
            <span>
              0
            </span>

            <span>
              12 glasses
            </span>
          </div>

        </div>

        {/* ACTIVITY */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              🏃
            </span>

            <div>
              <h3>
                How active were you?
              </h3>

              <p>
                Enter your approximate steps
                for today.
              </p>
            </div>

            <strong>
              {Number(
                steps
              ).toLocaleString()}{" "}
              steps
            </strong>

          </div>

          <input
            type="range"
            min="0"
            max="15000"
            step="500"
            value={steps}
            onChange={(e) =>
              setSteps(
                e.target.value
              )
            }
          />

          <div className="range-labels">
            <span>
              0
            </span>

            <span>
              15,000 steps
            </span>
          </div>

        </div>

        {/* SCREEN TIME */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              📱
            </span>

            <div>
              <h3>
                How much screen time did you have?
              </h3>

              <p>
                Include study, work and
                entertainment screen time.
              </p>
            </div>

            <strong>
              {screenTime} hrs
            </strong>

          </div>

          <input
            type="range"
            min="0"
            max="16"
            step="0.5"
            value={screenTime}
            onChange={(e) =>
              setScreenTime(
                e.target.value
              )
            }
          />

          <div className="range-labels">
            <span>
              0 hrs
            </span>

            <span>
              16 hrs
            </span>
          </div>

        </div>

        {/* MOOD */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              😊
            </span>

            <div>
              <h3>
                How are you feeling?
              </h3>

              <p>
                Choose the option that best
                describes your mood.
              </p>
            </div>

          </div>

          <div className="mood-options">

            {[
              "Great",
              "Good",
              "Okay",
              "Low",
              "Stressed",
            ].map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  className={`mood-option ${
                    mood === item
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setMood(
                      item
                    )
                  }
                >
                  {item}
                </button>
              )
            )}

          </div>

        </div>

        {/* ENERGY */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              ⚡
            </span>

            <div>
              <h3>
                What's your energy level?
              </h3>

              <p>
                Rate your energy from 1 to 10.
              </p>
            </div>

            <strong>
              {energy}/10
            </strong>

          </div>

          <input
            type="range"
            min="1"
            max="10"
            value={energy}
            onChange={(e) =>
              setEnergy(
                e.target.value
              )
            }
          />

          <div className="range-labels">
            <span>
              Low
            </span>

            <span>
              High
            </span>
          </div>

        </div>

        {/* STRESS */}

        <div className="checkin-card">

          <div className="checkin-question">

            <span className="question-icon">
              🧠
            </span>

            <div>
              <h3>
                How stressed do you feel?
              </h3>

              <p>
                Rate your current stress level
                from 1 to 10.
              </p>
            </div>

            <strong>
              {stress}/10
            </strong>

          </div>

          <input
            type="range"
            min="1"
            max="10"
            value={stress}
            onChange={(e) =>
              setStress(
                e.target.value
              )
            }
          />

          <div className="range-labels">
            <span>
              Relaxed
            </span>

            <span>
              Very stressed
            </span>
          </div>

        </div>

        {/* SCORE */}

        <div className="live-score">

          <div>

            <span>
              CURRENT WELLNESS SCORE
            </span>

            <div>

              <strong>
                {backendScore !== null
                  ? backendScore
                  : getCurrentScore()}
              </strong>

              <small>
                /100
              </small>

            </div>

          </div>

          <p>
            A general wellness indicator
            based on your check-in. It is
            not a medical measurement.
          </p>

        </div>

        {/* SAVE */}

        <button
          className="submit-checkin"
          type="submit"
          disabled={
            isSaving
          }
        >
          {isSaving
            ? supabaseSaving
              ? "Syncing with Supabase..."
              : "Sending to Python..."
            : "Save today's check-in →"}
        </button>

        {/* RESULT MESSAGE */}

        {saveMessage && (
          <div
            style={{
              marginTop:
                "14px",

              padding:
                "12px 16px",

              borderRadius:
                "12px",

              textAlign:
                "center",

              fontSize:
                "13px",

              lineHeight:
                "1.5",

              background:
                saveError
                  ? "rgba(255,90,90,0.08)"
                  : "rgba(80,220,150,0.08)",

              border:
                saveError
                  ? "1px solid rgba(255,90,90,0.25)"
                  : "1px solid rgba(80,220,150,0.25)",

              color:
                saveError
                  ? "#ff8b8b"
                  : "#72e0a3",
            }}
          >
            {saveMessage}
          </div>
        )}

      </form>

    </div>
  );
}

export default DailyCheckIn;
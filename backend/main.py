from pathlib import Path
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field, ConfigDict


# =========================================================
# ENVIRONMENT
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

OPENAI_API_KEY = os.getenv(
    "OPENAI_API_KEY",
    ""
).strip()

OPENAI_MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
).strip()


# =========================================================
# OPENAI CLIENT
# =========================================================

openai_client = None

if OPENAI_API_KEY:
    try:
        openai_client = OpenAI(
            api_key=OPENAI_API_KEY
        )
        print("[OpenAI] Client initialized.")
    except Exception as error:
        print(
            f"[OpenAI] Client initialization failed: {error}"
        )
        openai_client = None
else:
    print(
        "[OpenAI] API key not configured. "
        "WELLsync will use local AI mode."
    )


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="WELLsync API",
    description="Backend API for the WELLsync wellness companion.",
    version="4.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATA MODELS
# =========================================================

class WellnessData(BaseModel):
    """
    Wellness data received from the React frontend.

    The frontend uses screenTime.
    The backend internally uses screen_time.
    """

    model_config = ConfigDict(
        populate_by_name=True
    )

    sleep: float = Field(
        default=7,
        ge=0,
        le=24
    )

    water: float = Field(
        default=5,
        ge=0,
        le=30
    )

    steps: int = Field(
        default=6000,
        ge=0,
        le=100000
    )

    screen_time: float = Field(
        default=5,
        alias="screenTime",
        ge=0,
        le=24
    )

    mood: str = "Good"

    energy: float = Field(
        default=7,
        ge=1,
        le=10
    )

    stress: float = Field(
        default=4,
        ge=1,
        le=10
    )


class AIChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=3000
    )

    wellness_data: WellnessData | None = None

    goals: dict[str, Any] | None = None

    # Conversation history sent by AICompanion.jsx
    conversation: list[dict[str, str]] = Field(
        default_factory=list
    )


# =========================================================
# GENERAL HELPERS
# =========================================================

def safe_float(
    value: Any,
    default: float
) -> float:
    try:
        return float(value)
    except (
        TypeError,
        ValueError
    ):
        return default


def safe_int(
    value: Any,
    default: int
) -> int:
    try:
        return int(float(value))
    except (
        TypeError,
        ValueError
    ):
        return default


def normalize_goals(
    goals: dict[str, Any] | None
) -> dict[str, float]:
    """
    Supports both:
        screenTime
    and:
        screen_time
    """

    goals = goals or {}

    return {
        "sleep": safe_float(
            goals.get(
                "sleep",
                7
            ),
            7
        ),

        "water": safe_float(
            goals.get(
                "water",
                6
            ),
            6
        ),

        "steps": safe_float(
            goals.get(
                "steps",
                6000
            ),
            6000
        ),

        "screenTime": safe_float(
            goals.get(
                "screenTime",
                goals.get(
                    "screen_time",
                    6
                )
            ),
            6
        ),
    }


# =========================================================
# WELLNESS SCORE
# =========================================================

def calculate_wellness_score(
    data: WellnessData
) -> int:
    """
    WELLsync prototype lifestyle score.

    Weighting:
        Sleep       20%
        Hydration   15%
        Activity    20%
        Screen      10%
        Mood        15%
        Energy      10%
        Stress      10%

    This is a product heuristic, not a medical score.
    """

    # -------------------------------
    # Sleep
    # -------------------------------

    sleep_score = (
        min(
            data.sleep / 8.0,
            1.0
        ) * 100
    )

    # -------------------------------
    # Hydration
    # -------------------------------

    hydration_score = (
        min(
            data.water / 8.0,
            1.0
        ) * 100
    )

    # -------------------------------
    # Activity
    # -------------------------------

    activity_score = (
        min(
            data.steps / 8000.0,
            1.0
        ) * 100
    )

    # -------------------------------
    # Screen time
    # -------------------------------

    if data.screen_time <= 4:
        screen_score = 100
    else:
        screen_score = max(
            0,
            100
            - (
                data.screen_time - 4
            ) * 15
        )

    # -------------------------------
    # Mood
    # -------------------------------

    mood_scores = {
        "Great": 100,
        "Good": 85,
        "Okay": 65,
        "Low": 40,
        "Stressed": 25,
    }

    mood_score = mood_scores.get(
        data.mood,
        65
    )

    # -------------------------------
    # Energy
    # -------------------------------

    energy_score = (
        data.energy / 10.0
    ) * 100

    # -------------------------------
    # Stress
    # -------------------------------

    stress_score = (
        (10.0 - data.stress) / 9.0
    ) * 100

    stress_score = max(
        0,
        min(
            stress_score,
            100
        )
    )

    # -------------------------------
    # Weighted score
    # -------------------------------

    score = (
        sleep_score * 0.20
        + hydration_score * 0.15
        + activity_score * 0.20
        + screen_score * 0.10
        + mood_score * 0.15
        + energy_score * 0.10
        + stress_score * 0.10
    )

    return round(
        max(
            0,
            min(
                score,
                100
            )
        )
    )


# =========================================================
# WELLNESS ANALYSIS
# =========================================================

def analyze_wellness(
    data: WellnessData,
    goals: dict[str, Any] | None
) -> dict[str, Any]:
    """
    Analyze all wellness dimensions before selecting
    what should be discussed.
    """

    g = normalize_goals(goals)

    score = calculate_wellness_score(
        data
    )

    issues = []
    strengths = []

    # -------------------------------
    # Sleep
    # -------------------------------

    sleep_gap = max(
        0,
        g["sleep"] - data.sleep
    )

    if sleep_gap > 0:
        issues.append({
            "area": "sleep",
            "title": "Sleep",
            "priority": min(
                100,
                sleep_gap * 20
            ),
            "message": (
                f"You logged {data.sleep:g} hours "
                f"against a {g['sleep']:g}-hour goal."
            ),
        })
    else:
        strengths.append(
            "sleep"
        )

    # -------------------------------
    # Hydration
    # -------------------------------

    water_gap = max(
        0,
        g["water"] - data.water
    )

    if water_gap > 0:
        issues.append({
            "area": "hydration",
            "title": "Hydration",
            "priority": min(
                100,
                water_gap * 15
            ),
            "message": (
                f"You logged {data.water:g} glasses "
                f"against a {g['water']:g}-glass goal."
            ),
        })
    else:
        strengths.append(
            "hydration"
        )

    # -------------------------------
    # Activity
    # -------------------------------

    steps_gap = max(
        0,
        g["steps"] - data.steps
    )

    if steps_gap > 0:
        ratio = (
            steps_gap
            / max(
                g["steps"],
                1
            )
        )

        issues.append({
            "area": "activity",
            "title": "Activity",
            "priority": min(
                100,
                ratio * 100
            ),
            "message": (
                f"You are at {data.steps:,} steps "
                f"against a {g['steps']:,.0f}-step goal."
            ),
        })
    else:
        strengths.append(
            "activity"
        )

    # -------------------------------
    # Screen time
    # -------------------------------

    screen_excess = max(
        0,
        data.screen_time - g["screenTime"]
    )

    if screen_excess > 0:
        issues.append({
            "area": "screen",
            "title": "Screen time",
            "priority": min(
                100,
                screen_excess * 18
            ),
            "message": (
                f"Screen time is {data.screen_time:g} hours "
                f"against a {g['screenTime']:g}-hour goal."
            ),
        })
    else:
        strengths.append(
            "screen balance"
        )

    # -------------------------------
    # Stress
    # -------------------------------

    if data.stress >= 7:
        issues.append({
            "area": "stress",
            "title": "Stress",
            "priority": min(
                100,
                (data.stress - 6) * 25
            ),
            "message": (
                f"Your current stress signal is "
                f"{data.stress:g}/10."
            ),
        })
    elif data.stress <= 5:
        strengths.append(
            "stress balance"
        )

    # -------------------------------
    # Energy
    # -------------------------------

    if data.energy <= 4:
        issues.append({
            "area": "energy",
            "title": "Energy",
            "priority": min(
                100,
                (5 - data.energy) * 20
            ),
            "message": (
                f"Your current energy signal is "
                f"{data.energy:g}/10."
            ),
        })
    elif data.energy >= 7:
        strengths.append(
            "energy"
        )

    # -------------------------------
    # Mood
    # -------------------------------

    if data.mood in {
        "Good",
        "Great"
    }:
        strengths.append(
            "mood"
        )

    # -------------------------------
    # Sort issues
    # -------------------------------

    issues.sort(
        key=lambda item: item["priority"],
        reverse=True
    )

    # -------------------------------
    # Overall interpretation
    # -------------------------------

    if score >= 85:
        interpretation = (
            "Your tracked signals are broadly balanced today."
        )

    elif score >= 70:
        interpretation = (
            "Your routine has a solid foundation, "
            "with a few areas that could be improved."
        )

    elif score >= 50:
        interpretation = (
            "Several signals have room for improvement, "
            "so focusing on one or two priorities is more "
            "useful than changing everything."
        )

    else:
        interpretation = (
            "Several tracked signals are below their goals, "
            "so the best approach is to make small, "
            "manageable changes."
        )

    return {
        "score": score,
        "goals": g,
        "issues": issues,
        "strengths": strengths,
        "interpretation": interpretation,
    }


# =========================================================
# QUESTION ANALYSIS
# =========================================================

def analyze_question(
    question: str
) -> dict[str, Any]:
    """
    Identify the actual subject of the user's question.

    Several topics may be detected at once.
    """

    text = question.lower().strip()

    keyword_groups = {
        "score": [
            "score",
            "rating",
            "wellness score",
            "why is my score",
        ],

        "sleep": [
            "sleep",
            "slept",
            "sleeping",
            "tired",
            "rest",
            "bed",
        ],

        "hydration": [
            "water",
            "hydration",
            "drink",
            "thirst",
        ],

        "activity": [
            "step",
            "steps",
            "walk",
            "walking",
            "exercise",
            "activity",
            "movement",
            "workout",
        ],

        "screen": [
            "screen",
            "phone",
            "mobile",
            "social media",
            "instagram",
            "digital",
        ],

        "stress": [
            "stress",
            "stressed",
            "overwhelmed",
            "anxious",
        ],

        "energy": [
            "energy",
            "productive",
            "productivity",
            "motivation",
            "focus",
            "concentration",
        ],

        "today": [
            "today",
            "what should",
            "focus on",
            "priority",
            "priorities",
            "plan",
            "next",
        ],

        "overall": [
            "overall",
            "summary",
            "summarize",
            "analyze",
            "analysis",
            "how am i doing",
        ],

        "improve": [
            "improve",
            "better",
            "increase",
            "raise",
            "fix",
            "change",
            "help me improve",
        ],
    }

    scores = {}

    for topic, keywords in keyword_groups.items():

        topic_score = 0

        for keyword in keywords:
            if keyword in text:
                topic_score += len(keyword) + 1

        scores[topic] = topic_score

    ranked = sorted(
        scores.items(),
        key=lambda item: item[1],
        reverse=True
    )

    topics = [
        topic
        for topic, value in ranked
        if value > 0
    ]

    primary = (
        topics[0]
        if topics
        else "general"
    )

    return {
        "primary": primary,
        "topics": topics,
        "scores": scores,
        "question": question,
    }


# =========================================================
# CONVERSATION CONTEXT
# =========================================================

def get_previous_user_question(
    conversation: list[dict[str, str]]
) -> str:
    """
    Returns the latest user message BEFORE the current
    question.
    """

    if not conversation:
        return ""

    previous_user_messages = [
        item.get("content", "").strip()
        for item in conversation[:-1]
        if item.get("role") == "user"
        and item.get("content")
    ]

    if not previous_user_messages:
        return ""

    return previous_user_messages[-1]


def resolve_followup_intent(
    current_question: str,
    conversation: list[dict[str, str]]
) -> dict[str, Any]:
    """
    Handles short follow-ups such as:

        "Why?"
        "How?"
        "What about that?"
        "Tell me more."

    by looking at the previous user question.
    """

    current_analysis = analyze_question(
        current_question
    )

    if current_analysis["primary"] != "general":
        return current_analysis

    previous_question = (
        get_previous_user_question(
            conversation
        )
    )

    if not previous_question:
        return current_analysis

    previous_analysis = analyze_question(
        previous_question
    )

    if previous_analysis["primary"] != "general":
        return previous_analysis

    return current_analysis


def build_conversation_text(
    conversation: list[dict[str, str]]
) -> str:
    """
    Creates a compact conversation block for OpenAI.
    """

    if not conversation:
        return "No previous conversation."

    lines = []

    for item in conversation[-8:]:

        role = item.get(
            "role",
            "user"
        ).upper()

        content = item.get(
            "content",
            ""
        ).strip()

        if content:
            lines.append(
                f"{role}: {content}"
            )

    return "\n".join(lines)


# =========================================================
# LOCAL RESPONSE BUILDERS
# =========================================================

def build_score_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    return (
        f"Your current WELLsync score is "
        f"{analysis['score']}/100.\n\n"

        f"Today's tracked signals:\n"
        f"• Sleep: {data.sleep:g}h\n"
        f"• Hydration: {data.water:g} glasses\n"
        f"• Activity: {data.steps:,} steps\n"
        f"• Screen time: {data.screen_time:g}h\n"
        f"• Mood: {data.mood}\n"
        f"• Energy: {data.energy:g}/10\n"
        f"• Stress: {data.stress:g}/10\n\n"

        f"{analysis['interpretation']}\n\n"

        f"The score is a WELLsync product heuristic for "
        f"tracking everyday lifestyle patterns, not a "
        f"medical measurement."
    )


def build_sleep_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    target = analysis["goals"]["sleep"]

    if data.sleep < target:

        gap = target - data.sleep

        return (
            f"You logged {data.sleep:g} hours of sleep, "
            f"while your current goal is {target:g} hours.\n\n"

            f"That's a {gap:.1f}-hour difference, so sleep "
            f"is currently one of the areas below your "
            f"tracked target.\n\n"

            f"A practical approach is to protect a consistent "
            f"wind-down and sleep window rather than trying "
            f"to change several things at once."
        )

    return (
        f"You logged {data.sleep:g} hours against your "
        f"{target:g}-hour goal, so your sleep is currently "
        f"meeting your tracked target.\n\n"

        f"That means sleep is not the main goal gap in "
        f"today's data."
    )


def build_hydration_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    target = analysis["goals"]["water"]

    if data.water < target:

        gap = target - data.water

        return (
            f"You're currently at {data.water:g} glasses "
            f"against your {target:g}-glass goal.\n\n"

            f"That's {gap:.1f} glass(es) below your target, "
            f"so hydration is currently one of your measurable "
            f"goal gaps.\n\n"

            f"Spread your remaining intake throughout the day "
            f"instead of trying to make up the whole gap at once."
        )

    return (
        f"You're at {data.water:g} glasses against a "
        f"{target:g}-glass goal, so hydration is currently "
        f"meeting your tracked target.\n\n"

        f"That makes hydration one of the stronger signals "
        f"in today's check-in."
    )


def build_activity_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    target = analysis["goals"]["steps"]

    if data.steps < target:

        gap = target - data.steps

        return (
            f"You're at {data.steps:,} steps against your "
            f"{target:,.0f}-step goal.\n\n"

            f"That leaves about {gap:,.0f} steps to your "
            f"tracked target.\n\n"

            f"A short walk or a few movement breaks during "
            f"the day can be a simple way to add activity."
        )

    return (
        f"You're at {data.steps:,} steps against a "
        f"{target:,.0f}-step goal, so activity is currently "
        f"meeting your tracked target."
    )


def build_screen_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    target = analysis["goals"]["screenTime"]

    if data.screen_time > target:

        excess = (
            data.screen_time - target
        )

        return (
            f"Your screen time is {data.screen_time:g} hours "
            f"against a {target:g}-hour goal.\n\n"

            f"You're {excess:.1f} hour(s) above that target.\n\n"

            f"Rather than eliminating screens completely, "
            f"try creating one deliberate screen-free block "
            f"today, especially around rest."
        )

    return (
        f"Your screen time is {data.screen_time:g} hours "
        f"against a {target:g}-hour goal.\n\n"

        f"You're currently within your tracked target."
    )


def build_stress_response(
    data: WellnessData
) -> str:

    if data.stress >= 7:

        return (
            f"Your current stress signal is "
            f"{data.stress:g}/10.\n\n"

            f"That is one of the stronger signals in today's "
            f"check-in, so a small recovery window may be useful.\n\n"

            f"Pause from your current task, take a short reset, "
            f"and then return to one manageable task."
        )

    if data.stress >= 5:

        return (
            f"Your stress signal is "
            f"{data.stress:g}/10.\n\n"

            f"It is worth keeping an eye on alongside your "
            f"energy and mood, but it is not currently your "
            f"strongest gap."
        )

    return (
        f"Your stress signal is "
        f"{data.stress:g}/10.\n\n"

        f"Within WELLsync's tracking scale, stress is not "
        f"currently one of your main improvement areas."
    )


def build_energy_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    if analysis["issues"]:

        top_issue = (
            analysis["issues"][0]["title"]
        )

    else:
        top_issue = "consistency"

    return (
        f"Your energy is {data.energy:g}/10, "
        f"your mood is {data.mood}, and your stress "
        f"is {data.stress:g}/10.\n\n"

        f"Looking at those signals together, your clearest "
        f"current improvement area is {top_issue.lower()}.\n\n"

        f"For productivity, choose one clearly defined task "
        f"and a focused work block instead of trying to "
        f"maximize the entire day."
    )


def build_today_response(
    analysis: dict[str, Any]
) -> str:

    issues = analysis["issues"]

    if not issues:

        return (
            f"Your current WELLsync score is "
            f"{analysis['score']}/100.\n\n"

            f"None of your main tracked signals are currently "
            f"below their goals, so today's priority is "
            f"consistency rather than adding more habits."
        )

    response = (
        f"Your current WELLsync score is "
        f"{analysis['score']}/100.\n\n"

        f"The clearest areas to focus on today are:\n"
    )

    for issue in issues[:3]:

        response += (
            f"• {issue['title']}: "
            f"{issue['message']}\n"
        )

    response += (
        "\nStart with the first priority instead of "
        "trying to change everything at once."
    )

    return response


def build_improvement_response(
    analysis: dict[str, Any]
) -> str:

    issues = analysis["issues"]

    if not issues:

        return (
            f"Your current score is "
            f"{analysis['score']}/100, and your main tracked "
            f"goals are currently being met.\n\n"

            f"The clearest way to improve from here is "
            f"consistency rather than adding lots of new habits."
        )

    top = issues[0]

    return (
        f"Your current WELLsync score is "
        f"{analysis['score']}/100.\n\n"

        f"The clearest measurable improvement area is "
        f"{top['title']} because {top['message']}\n\n"

        f"I'd improve that one area first before trying "
        f"to change everything else."
    )


def build_overall_response(
    data: WellnessData,
    analysis: dict[str, Any]
) -> str:

    response = (
        f"Your current wellness signal is "
        f"{analysis['score']}/100.\n\n"

        f"{analysis['interpretation']}\n"
    )

    if analysis["issues"]:

        response += (
            "\nCurrent goal gaps:\n"
        )

        for issue in analysis["issues"][:3]:

            response += (
                f"• {issue['title']}: "
                f"{issue['message']}\n"
            )

    if analysis["strengths"]:

        response += (
            "\nCurrent strengths include "
            f"{', '.join(analysis['strengths'][:4])}."
        )

    return response


def build_general_response(
    data: WellnessData,
    analysis: dict[str, Any],
    question_analysis: dict[str, Any]
) -> str:

    topics = question_analysis["topics"]

    if topics:

        return (
            f"I understand you're asking about "
            f"{', '.join(topics[:3])}.\n\n"

            f"Your current wellness score is "
            f"{analysis['score']}/100.\n\n"

            f"Relevant current signals:\n"
            f"• Sleep: {data.sleep:g}h\n"
            f"• Water: {data.water:g} glasses\n"
            f"• Steps: {data.steps:,}\n"
            f"• Screen time: {data.screen_time:g}h\n"
            f"• Mood: {data.mood}\n"
            f"• Energy: {data.energy:g}/10\n"
            f"• Stress: {data.stress:g}/10"
        )

    return (
        f"Your current WELLsync score is "
        f"{analysis['score']}/100.\n\n"

        f"I can help you understand your sleep, hydration, "
        f"activity, screen time, stress, energy, goals, "
        f"or overall wellness pattern."
    )


# =========================================================
# LOCAL AI ENGINE
# =========================================================

def build_local_ai_response(
    request: AIChatRequest
) -> tuple[str, dict[str, Any]]:

    # -----------------------------------------------------
    # Detect current intent
    # -----------------------------------------------------

    question_analysis = resolve_followup_intent(
        request.message,
        request.conversation
    )

    # -----------------------------------------------------
    # No wellness data
    # -----------------------------------------------------

    if request.wellness_data is None:

        response = (
            "I don't have your latest wellness check-in "
            "available right now.\n\n"

            "Complete a Daily Check-In first, and I'll use "
            "your actual data to personalize the conversation."
        )

        debug = {
            "intent": question_analysis["primary"],
            "topics": question_analysis["topics"],
            "has_wellness_data": False,
        }

        return response, debug

    # -----------------------------------------------------
    # Analyze data
    # -----------------------------------------------------

    data = request.wellness_data

    analysis = analyze_wellness(
        data,
        request.goals
    )

    intent = question_analysis["primary"]

    # -----------------------------------------------------
    # Improve
    # -----------------------------------------------------

    if (
        "improve"
        in question_analysis["topics"]
        and intent not in {
            "sleep",
            "hydration",
            "activity",
            "screen",
            "stress",
            "energy",
        }
    ):
        response = build_improvement_response(
            analysis
        )

    # -----------------------------------------------------
    # Score
    # -----------------------------------------------------

    elif intent == "score":

        response = build_score_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # Sleep
    # -----------------------------------------------------

    elif intent == "sleep":

        response = build_sleep_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # Hydration
    # -----------------------------------------------------

    elif intent == "hydration":

        response = build_hydration_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # Activity
    # -----------------------------------------------------

    elif intent == "activity":

        response = build_activity_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # Screen
    # -----------------------------------------------------

    elif intent == "screen":

        response = build_screen_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # Stress
    # -----------------------------------------------------

    elif intent == "stress":

        response = build_stress_response(
            data
        )

    # -----------------------------------------------------
    # Energy
    # -----------------------------------------------------

    elif intent == "energy":

        response = build_energy_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # Today
    # -----------------------------------------------------

    elif intent == "today":

        response = build_today_response(
            analysis
        )

    # -----------------------------------------------------
    # Overall
    # -----------------------------------------------------

    elif intent == "overall":

        response = build_overall_response(
            data,
            analysis
        )

    # -----------------------------------------------------
    # General
    # -----------------------------------------------------

    else:

        response = build_general_response(
            data,
            analysis,
            question_analysis
        )

    debug = {
        "intent": intent,
        "topics": question_analysis["topics"],
        "score": analysis["score"],
        "top_issue": (
            analysis["issues"][0]["area"]
            if analysis["issues"]
            else None
        ),
        "has_wellness_data": True,
    }

    return response, debug


# =========================================================
# OPENAI
# =========================================================

def build_openai_response(
    request: AIChatRequest
) -> str:

    if openai_client is None:

        raise RuntimeError(
            "OpenAI client is not configured."
        )

    # -----------------------------------------------------
    # Wellness context
    # -----------------------------------------------------

    if request.wellness_data:

        data = request.wellness_data

        analysis = analyze_wellness(
            data,
            request.goals
        )

        wellness_context = f"""
Sleep: {data.sleep:g} hours
Hydration: {data.water:g} glasses
Steps: {data.steps:,}
Screen time: {data.screen_time:g} hours
Mood: {data.mood}
Energy: {data.energy:g}/10
Stress: {data.stress:g}/10

WELLsync score: {analysis['score']}/100

Goals:
- Sleep: {analysis['goals']['sleep']:g} hours
- Water: {analysis['goals']['water']:g} glasses
- Steps: {analysis['goals']['steps']:,.0f}
- Screen time: {analysis['goals']['screenTime']:g} hours

Current priority areas:
{
    ", ".join(
        issue["title"]
        for issue in analysis["issues"][:3]
    )
    if analysis["issues"]
    else "None"
}
"""

    else:

        wellness_context = (
            "No current wellness data is available."
        )

    # -----------------------------------------------------
    # Conversation
    # -----------------------------------------------------

    conversation_text = (
        build_conversation_text(
            request.conversation
        )
    )

    # -----------------------------------------------------
    # System instructions
    # -----------------------------------------------------

    system_instructions = """
You are WELLsync AI, a personalized conversational
wellness companion.

Your job is to help the user understand their own
everyday wellness data and choose realistic next actions.

IMPORTANT RULES:

1. Answer the user's actual question.
2. Do not give the same generic answer to unrelated questions.
3. Use the supplied numbers when relevant.
4. Consider multiple wellness signals together when useful.
5. Never invent a value that was not supplied.
6. Never diagnose a medical condition.
7. Never present the WELLsync score as clinically validated.
8. Do not exaggerate health consequences.
9. Give practical, manageable next steps.
10. Keep answers conversational rather than robotic.
11. For follow-up questions, use the recent conversation context.
12. If information is missing, say that it is missing.
13. Avoid overwhelming the user with a long checklist.
14. Prefer one or two useful actions.
15. The goal is understanding and sustainable everyday habits.
"""

    # -----------------------------------------------------
    # User prompt
    # -----------------------------------------------------

    user_prompt = f"""
RECENT CONVERSATION:

{conversation_text}

CURRENT USER QUESTION:

{request.message}

CURRENT WELLNESS CONTEXT:

{wellness_context}

Answer the current question specifically.
"""

    # -----------------------------------------------------
    # OpenAI request
    # -----------------------------------------------------

    result = openai_client.responses.create(
        model=OPENAI_MODEL,
        instructions=system_instructions,
        input=user_prompt,
    )

    text = getattr(
        result,
        "output_text",
        None
    )

    if not text:

        raise RuntimeError(
            "OpenAI returned no text output."
        )

    return text.strip()


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "name": "WELLsync API",
        "status": "online",
        "version": "4.0.0",
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "backend": "online",
        "openai_configured": bool(
            OPENAI_API_KEY
        ),
        "openai_model": (
            OPENAI_MODEL
            if OPENAI_API_KEY
            else None
        ),
    }


# =========================================================
# WELLNESS SCORE
# =========================================================

@app.post("/wellness/score")
def wellness_score(
    data: WellnessData
):

    analysis = analyze_wellness(
        data,
        None
    )

    return {
        "score": analysis["score"],
        "source": "python",
        "analysis": {
            "interpretation":
                analysis["interpretation"],

            "priorities":
                analysis["issues"],

            "strengths":
                analysis["strengths"],
        },
    }


# =========================================================
# AI CHAT
# =========================================================

@app.post("/ai/chat")
def ai_chat(
    request: AIChatRequest
):

    # -----------------------------------------------------
    # OPENAI FIRST
    # -----------------------------------------------------

    if openai_client is not None:

        try:

            response = build_openai_response(
                request
            )

            return {
                "response": response,
                "source": "openai",
            }

        except Exception as error:

            print(
                "[AI] OpenAI request failed."
            )

            print(
                f"[AI] {error}"
            )

            print(
                "[AI] Falling back to local AI."
            )

    # -----------------------------------------------------
    # LOCAL AI
    # -----------------------------------------------------

    response, debug = (
        build_local_ai_response(
            request
        )
    )

    return {
        "response": response,
        "source": "local-fallback",
        "debug": debug,
    }
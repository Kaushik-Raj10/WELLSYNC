# WELLsync

> **Your Personal Wellness Command Center**

WELLsync is a modern, AI-powered wellness and lifestyle dashboard designed to help users understand daily habits, discover personal patterns, and turn wellness data into practical actions.

## ✨ Features

- 💤 Sleep tracking
- 💧 Hydration tracking
- 🚶 Step/activity tracking
- 🖥️ Screen-time tracking
- 😊 Mood tracking
- ⚡ Energy tracking
- 🧠 Stress tracking
- 🎯 Personal goals
- 📊 Wellness analytics
- 🤖 AI wellness companion
- 🔎 Personal pattern detection
- 📈 Historical trend analysis
- ☁️ Supabase cloud synchronization

The wellness score is a transparent prototype heuristic and is **not medically validated**.

## 🧠 AI Companion

WELLsync uses Google Gemini for its AI intelligence layer. The backend can use specialized tools for current wellness data, goal gaps, history summaries, personal patterns, training context, and nutrition context.

Python/backend tools handle factual retrieval and calculations; Gemini handles interpretation and communication. The AI is intended for general wellness guidance, not medical diagnosis or treatment.

## 📊 Dashboard

The dashboard provides the wellness score, today's signals, AI wellness brief, trends, goals, and time-aware scenic backgrounds.

The supplied scenic images automatically change according to local time:

```text
05:00 – 11:59  → Morning
12:00 – 16:59  → Day
17:00 – 20:59  → Evening
21:00 – 04:59  → Night
```

Background assets:

```text
public/
└── wellsync-scenes/
    ├── morning.jpg
    ├── day.jpg
    ├── evening.jpg
    └── night.jpg
```

No artificial sun, moon, stars, or sky objects are rendered over the supplied images.

## 🧩 App Sections

### Dashboard
Central wellness command center with today's signals, score, trends, goals, and AI guidance.

### Daily Check-In
Records daily sleep, hydration, activity, screen time, mood, energy, and stress.

### AI Companion
Conversational AI for questions about the user's wellness context.

### Insights
Personal patterns, strengths, opportunities, and longer-term wellness signals.

### Analytics
Historical trend exploration and metric analysis.

### Goals
Personal wellness targets and progress.

## 🏗️ Tech Stack

### Frontend
- React
- Vite
- JavaScript / JSX
- CSS
- Recharts
- Supabase Auth

### Backend
- Python
- FastAPI
- Google Gemini
- Google GenAI SDK

### Data & Authentication
- Supabase
- PostgreSQL
- Row Level Security (RLS)

### Deployment
- Vercel — frontend
- Render — backend
- GitHub — source control

## 📁 Project Structure

```text
WELLSYNC/
├── public/
│   └── wellsync-scenes/
│       ├── morning.jpg
│       ├── day.jpg
│       ├── evening.jpg
│       └── night.jpg
├── src/
│   ├── components/
│   ├── lib/
│   └── utils/
├── backend/
├── package.json
├── vite.config.js
├── index.html
└── README.md
```

## 🚀 Run Locally

Clone the repository:

```bash
git clone https://github.com/Kaushik-Raj10/WELLSYNC.git
cd WELLSYNC
```

Install frontend dependencies:

```bash
npm install
```

Create `.env.local` and configure the required frontend environment variables. For local development the API URL is normally:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the frontend on Windows:

```powershell
npm.cmd run dev
```

Frontend:

```text
http://localhost:5173/
```

## 🐍 Backend

From the project directory:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

## 🔐 Environment Variables

Keep secrets outside Git. Example backend configuration:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_configured_gemini_model
GEMINI_FALLBACK_MODELS=your_fallback_models
GEMINI_MAX_RETRIES=1
```

Never commit API keys, `.env`, `.env.local`, backend secrets, or Supabase service-role credentials.

## ☁️ Data Architecture

WELLsync supports local browser storage as a fallback and Supabase cloud synchronization for authenticated users. Cloud data includes daily check-ins and goals, protected by Supabase Row Level Security.

## 📈 Wellness Score

Current prototype weighting:

| Signal | Weight |
|---|---:|
| Sleep | 20% |
| Hydration | 15% |
| Activity | 20% |
| Screen time | 10% |
| Mood | 15% |
| Energy | 10% |
| Stress | 10% |

This is a product-level wellness signal, not a medical measurement.

## 🎯 Goals

Goals currently cover sleep, water, steps, and screen time. Progress can be surfaced through the AI companion.

## 🔄 AI Handoff

Insights and Analytics can hand relevant context to the AI Companion, allowing users to move from a detected pattern or chart to an AI explanation and practical action plan.

## 📱 Responsive Design

WELLsync is designed for desktop, tablet, and mobile, including responsive layouts, mobile navigation, touch-friendly controls, safe-area handling, and dynamic viewport sizing.

## 🌐 Production

Frontend:

```text
https://wellsync-eight.vercel.app/
```

Backend:

```text
https://wellsync-backend.onrender.com
```

GitHub:

```text
https://github.com/Kaushik-Raj10/WELLSYNC
```

## 🛡️ Wellness Disclaimer

WELLsync is a wellness and lifestyle application intended to help users understand everyday habits and build sustainable routines. It does not provide medical diagnosis, prescribe medication, or replace professional medical advice.

## 👥 Project

**WELLsync** — AI + Lifestyle + Data + Personalization + Modern UX.

## 📌 Development Status

- [x] React/Vite frontend
- [x] Supabase authentication
- [x] Cloud wellness data
- [x] Daily check-ins
- [x] Wellness score
- [x] Dashboard
- [x] AI Companion
- [x] Gemini backend
- [x] Agentic AI tools
- [x] Insights
- [x] Analytics
- [x] Goals
- [x] Responsive mobile shell
- [x] Time-aware scenic dashboard backgrounds
- [x] Vercel deployment
- [x] Render backend deployment

## 📄 License

This project is currently maintained as a personal/hackathon project.

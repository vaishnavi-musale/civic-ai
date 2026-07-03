# CivicAI

AI-powered civic issue reporting platform built for Indian communities — Vibe2Ship Hackathon submission.

**Problem Statement:** Community Hero — Hyperlocal Problem Solver

---

## Key Features

- **Photo-based issue reporting** — Drag-drop / camera capture with automatic upload to Supabase Storage
- **AI photo analysis** — Groq-powered (Llama 4 Scout 17B for vision, Llama 3.3 70B for text) classification: category, severity, priority score, recommended department, emergency detection
- **Duplicate detection** — Two-layer (heuristic similarity + Groq AI) to prevent redundant reports
- **Multilingual support** — Report in Hindi, Marathi, Tamil, Telugu, or Bengali; auto-translated to English via Groq
- **Voice reporting** — Web Speech API recognition + Groq transcript cleanup
- **AI chat assistant** — Global floating chatbot with issue context awareness
- **QR code generation** — Per-issue QR code for tracking; downloadable as PNG
- **PDF reports** — Server-side (pdf-lib) and client-side (jsPDF) formatted reports with AI analysis
- **Live issue timeline** — 6-step progress tracker (Reported → Assigned → Dispatched → In Progress → Verification → Completed)
- **Community voting** — Confirm / deny / upvote issues with reputation points
- **Comments** — Per-issue threaded comments with optimistic UI and masked emails
- **Leaderboard & badges** — Civic points + tiered badges (Newcomer → Active Citizen → Community Hero → City Champion)
- **Map with pins & heatmap** — Leaflet/OpenStreetMap with severity-colored circle markers + density heatmap layer
- **Admin dashboard** — 5-tab panel: Issues Queue (status + timeline control), Insights (AI-generated weekly report), Analytics (charts: bar, pie, severity breakdown, top locations), Broadcast system, Emergency alerts
- **Resolution verification** — Before/after photo comparison with Groq AI verification
- **Emergency auto-broadcast** — If AI detects a critical safety risk, an emergency alert is automatically published

---

## Tech Stack

| Layer   | Technology                                                                 |
| ------- | -------------------------------------------------------------------------- |
| Frontend| React 19, Vite 8, Tailwind CSS 3.4, React Router 7                        |
| Backend | Node.js, Express 5                                                         |
| Database| Supabase (PostgreSQL) — Auth, Storage, Row Level Security                  |
| AI      | Groq SDK — Llama 3.3 70B (text), Llama 4 Scout 17B (vision) |
| Maps    | Leaflet + react-leaflet + leaflet.heat (OpenStreetMap tiles)               |
| Icons   | Lucide React                                                               |
| Charts  | Recharts                                                                   |
| PDF     | pdf-lib (server) + jsPDF (client)                                          |
| Images  | Sharp (compression), Supabase Storage                                      |

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq API key](https://console.groq.com) (free tier)

### 1. Clone & install dependencies

```
cd civic-ai
```

**Backend:**
```
cd backend
npm install
```

**Frontend:**
```
cd frontend
npm install
```

### 2. Environment variables

**Root `.env`** — Copy from `.env.example` and fill in your values:

```
GROQ_API_KEY=gsk_your_groq_api_key
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
ADMIN_EMAIL=youremail@gmail.com
```

> Note: The `.env.example` file still references `GEMINI_API_KEY` (legacy name). The project actually uses `GROQ_API_KEY` with the Groq SDK. Rename the variable when setting up.

**Frontend `frontend/.env`:**
```
VITE_API_BASE_URL=http://localhost:5000
```

The Supabase and admin email values from the root `.env` are also read by the backend via `dotenv`.

### 3. Database setup

Run these SQL migration files in your Supabase SQL Editor (order matters):

1. `backend/supabase_reputation_migration.sql`
2. `backend/supabase_timeline_migration.sql`
3. `backend/supabase_comments_migration.sql`

### 4. Start the app

```
# Terminal 1 — Backend (http://localhost:5000)
cd backend
npm start

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

---

## Demo Credentials

### Citizen
- **Email:** citizen@demo.com
- **Password:** Demo@123

### Admin
- **Email:** admin@demo.com
- **Password:** Demo@123

Set `ADMIN_EMAIL` / `VITE_ADMIN_EMAIL` in your `.env` to `musalevaishnavi30@gmail.com,admin@demo.com` to recognize both existing and demo admin accounts. The auth system supports comma-separated admin emails.

---

## Live Demo

[Add deployed link here]

---

## Known Limitations / Technical Notes

- **AI provider:** All AI inference uses Groq's hosted models (Llama 3.3 70B for text tasks, Llama 4 Scout 17B for vision) rather than direct Gemini API calls. The `@google/generative-ai` package is installed but unused. Groq was chosen for free-tier reliability and rate limits during hackathon development.
- **Mapping:** Uses OpenStreetMap + Leaflet instead of Google Maps to avoid requiring a billing account for a student project. No API key needed.
- **Auth:** Password-based email login via Supabase Auth. Admin role is determined by matching the user's email to `ADMIN_EMAIL` env var — no separate admin signup flow.
- **No real-time updates:** The app uses polling for data freshness rather than WebSockets or Supabase Realtime subscriptions.
- **No test suite:** Built for a hackathon timeframe — unit/E2E tests are not included.
- **Department routing:** `recommended_department` is AI-suggested but not connected to an actual ticketing or dispatch system.

---

## Author

**Vaishnavi Musale** — Built for Vibe2Ship Hackathon 2026

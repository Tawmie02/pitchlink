# PitchLink — Match-Day Communication Platform

Match-day communication platform for grassroots sports organizers, built on Africa's Talking SMS, USSD, and Voice APIs.

PitchLink provides organizers with a centralized web dashboard to manage match-day coordination without relying exclusively on mobile internet or muted WhatsApp groups. It ensures players, team captains, coaches, and referees receive critical fixture updates regardless of connectivity.

---

## 1. Project Structure

```
pitchlink/
├── backend/                  Express API + SQLite database
│   ├── .env                   <-- Pre-configured with team AT Sandbox credentials & ngrok URL
│   ├── .env.example           <-- Template environment configuration
│   └── src/
│       ├── server.js          <-- Main server + global error handling middleware
│       ├── db/                <-- SQLite schema + seed script with salted bcrypt auth
│       ├── lib/               <-- Password helper (bcryptjs) & phone normalizer (E.164)
│       ├── routes/
│       │   ├── auth.js        <-- JWT Login & authentication
│       │   ├── teams.js       <-- Team CRUD & contact roster management
│       │   ├── matches.js     <-- Match scheduling, SMS notify, voice alert, simulate reply
│       │   ├── sms.js         <-- AT SMS webhook (inbound replies & delivery reports)
│       │   ├── ussd.js        <-- AT USSD stateful engine (POST /api/ussd)
│       │   └── voice.js       <-- AT Voice callback (POST /api/voice/events)
│       └── services/
│           └── africastalking.js <-- Africa's Talking SDK wrapper with mock fallback
└── frontend/                 React dashboard (Vite + Tailwind CSS)
    └── src/
        ├── pages/             <-- Dashboard, Matches, MatchDetail, Teams, Login
        ├── components/        <-- Sidebar (Dark Mode toggle), Toast, ErrorBoundary, UI
        └── lib/               <-- API client with offline error resilience
```

---

## 2. Quick Start

```bash
# 1. Backend Setup
cd backend
npm install
npm run seed                # Seeds demo teams, matches, and hashed organizer login
npm start                   # Server running at http://localhost:4000

# 2. Frontend Setup (separate terminal)
cd frontend
npm install
npm run dev                 # React UI running at http://localhost:5173
```

Log in with demo credentials:
- **Email:** `organizer@pitchlink.dev`
- **Password:** `password123`

---

## 3. Team Credentials & Africa's Talking Configuration

The project is pre-configured in `backend/.env` with your team's sandbox credentials and ngrok domain:

```env
AT_USERNAME=sandbox
AT_API_KEY=atsk_64efaaa2f373aa8d7e4ce213974aad1b208e94fb92145f47269d374f16202239dde3a736
PUBLIC_URL=https://unearth-juvenile-reason.ngrok-free.dev
```

### Registered Callbacks in AT Dashboard

| Channel | Dashboard Path | Registered Callback URL |
|---|---|---|
| **USSD** | Sandbox app → USSD → Channel → Callback URL | `https://unearth-juvenile-reason.ngrok-free.dev/api/ussd` |
| **Voice** | Sandbox app → Voice → Phone numbers → Callback URL | `https://unearth-juvenile-reason.ngrok-free.dev/api/voice/events` |
| **Incoming Messages** | Sandbox app → SMS → Inbound Messages Callback URL | `https://unearth-juvenile-reason.ngrok-free.dev/api/sms/inbound` |
| **Delivery Reports** | Sandbox app → SMS → Delivery Reports Callback URL | `https://unearth-juvenile-reason.ngrok-free.dev/api/sms/delivery` |

---

## 4. Operational Features & Highlights

- 🌙 **Dark Mode & Aesthetics:** Instant Light/Dark theme toggle in the sidebar with tailored dark color tokens.
- 📱 **Stateful USSD Engine:** Stateful session management stored in `ussd_sessions` table with `0` back navigation and `99. Next / 88. Prev` match list pagination.
- 💬 **Live SMS Character & Segment Preview:** Real-time character counter and segment calculation displaying the appended sponsorship tag (`-- Powered by Java House Nairobi`).
- ⚽ **Linesmen & Assistant Referees:** Auto-assigns Primary Referees and Assistant Referees (Linesmen) to match fixtures.
- 🛡️ **System-Wide Error Handling:** Express error handling middleware returning channel-appropriate fallbacks (JSON for API, plain text for USSD, XML for Voice) and React Error Boundary for frontend resilience.

# PitchLink — MVP

Match-day communication for grassroots sports organizers, built on Africa's
Talking SMS, USSD and Voice APIs.

This is a working full-stack build of the PRD: React (Vite + Tailwind)
frontend, Node/Express + SQLite backend. It runs out of the box in **mock
mode** (no Africa's Talking credentials needed to demo the UI/flows), and
becomes fully live the moment you add a sandbox API key.

---

## 1. Project structure

```
pitchlink/
├── backend/                  Express API + SQLite database
│   ├── .env.example           <-- copy to .env, fill in AT credentials here
│   └── src/
│       ├── server.js
│       ├── db/                schema + seed data (5 teams, 4 matches)
│       ├── routes/
│       │   ├── auth.js
│       │   ├── teams.js
│       │   ├── matches.js     SMS notify, voice cancel-alert, simulate-reply
│       │   ├── ussd.js        <-- AT USSD webhook (POST /api/ussd)
│       │   └── voice.js       <-- AT Voice callback (POST /api/voice/events)
│       └── services/
│           └── africastalking.js   <-- the ONLY file that calls the AT SDK
└── frontend/                 React dashboard (Vite + Tailwind)
    └── src/
        ├── pages/             Dashboard, Matches, MatchDetail, Teams, Login
        └── components/        Sidebar, Toast, shared UI primitives
```

---

## 2. Quick start (mock mode — no AT account needed)

```bash
# Backend
cd backend
npm install
cp .env.example .env      # defaults work fine for mock mode
npm run seed               # loads 5 demo teams + 4 demo matches
npm start                  # http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Log in with the pre-filled demo credentials:
- **Email:** `organizer@pitchlink.dev`
- **Password:** `password123`

In mock mode, every "Send SMS" / "Cancel match" action works exactly like
production — it just logs to the backend console and saves the message as
`simulated` in the DB instead of hitting Africa's Talking's servers. This
means the whole dashboard demo works immediately without any signup.

---

## 3. Turning on real Africa's Talking (SMS / Voice / USSD)

### 3.1 Get sandbox credentials
1. Sign up free: https://account.africastalking.com/auth/register
2. Open your **Sandbox** app → **Settings → API Key** → generate a key.
   (Docs: https://developers.africastalking.com/docs/account/generate_api_key)
3. Your sandbox **username is always the literal word `sandbox`** — not your
   email or company name. This trips people up constantly.

### 3.2 Add them to `backend/.env`
```env
AT_USERNAME=sandbox
AT_API_KEY=your_real_sandbox_key_here
```
That's the only file you need to touch. `services/africastalking.js`
auto-detects a real key and switches out of mock mode — you'll see
`Africa's Talking mode: LIVE (sandbox)` in the server startup log.

### 3.3 Expose your backend publicly (needed for USSD + Voice webhooks)
Africa's Talking calls **your server**, not the other way around, for USSD
menu input and voice call events — so `localhost:4000` must be reachable
from the internet during development. The standard way:

```bash
npx ngrok http 4000
```
This prints a public URL like `https://a1b2-41-90-64-1.ngrok-free.app`.
Put it in `backend/.env` as `PUBLIC_URL` (for your own reference) — but the
step that actually matters is registering it in the AT dashboard:

| Channel | Where to set it in the AT dashboard | Callback URL to paste |
|---|---|---|
| **USSD** | Sandbox app → USSD → your channel → *Callback URL* | `{PUBLIC_URL}/api/ussd` |
| **Voice** | Sandbox app → Voice → your number → *Callback URL* | `{PUBLIC_URL}/api/voice/events` |
| **SMS delivery reports** (optional) | Sandbox app → SMS → *Delivery Reports Callback URL* | `{PUBLIC_URL}/api/sms/delivery` |

Every time ngrok restarts, the URL changes — so you'll re-paste it into the
dashboard each dev session. (A paid ngrok plan or a real deployment gets you
a stable URL.)

### 3.4 Get a USSD service code + Voice number
- **USSD**: Sandbox app → USSD → *Create channel* gives you a code like
  `*384*00000#`. Put it in `.env` as `AT_USSD_SERVICE_CODE` (informational —
  you'll actually dial it in the AT Simulator, see below).
- **Voice**: Sandbox app → Voice → *Phone numbers* gives you a caller ID
  number. Put it in `.env` as `AT_VOICE_CALLER_ID` — this is required, the
  Voice API call will fail without it.

### 3.5 Test USSD live
Don't build a phone emulator — Africa's Talking provides one:
https://developers.africastalking.com/simulator
Enter your phone number and USSD service code there, and it'll hit your
`/api/ussd` webhook exactly like a real phone would.

### 3.6 Test SMS replies live
To demo the SMS flow, register these callbacks in the Africa's Talking SMS
dashboard using your ngrok URL:

- Incoming Messages -> `{PUBLIC_URL}/api/sms/inbound`
- Delivery Reports -> `{PUBLIC_URL}/api/sms/delivery`

Then send a reminder from the match detail screen. The recipient gets the
match details by SMS and can reply `YES` or `NO`; the backend updates the
attendance status, sends a confirmation SMS, and records the exchange in the
match message feed.

---

## 4. What's genuinely "live" vs. demo-optimized

| Feature | Status |
|---|---|
| SMS notifications (with 40-char sponsor tag) | Real AT SMS API call once credentials are set |
| Emergency voice cancellation alert (TTS) | Real AT Voice API call once credentials are set |
| USSD attendance flow (view matches / confirm / decline) | Real webhook, fully stateful, tested against the request/response contract AT's simulator uses |
| "Simulate Reply" buttons on the match page | Deliberately instant/local — per the PRD's demo-optimization requirement, so you don't have to dial USSD live mid-presentation |
| Auth | Simple email/password + JWT — intentionally minimal for a hackathon MVP, not hardened for production |

---

## 5. Notes & known limitations
- Database is SQLite (`backend/src/db/pitchlink.db`), created automatically
  on first run. Delete it and re-run `npm run seed` to reset demo data.
- CORS is wide open and there's no rate limiting — fine for a hackathon demo,
  not for production.
- The PRD's "Spring Boot" backend recommendation was swapped for Node/Express
  to keep the whole stack running in one lightweight environment without a
  JVM/Postgres setup; the API contracts (USSD payload shape, response
  format, SMS/Voice trigger endpoints) match the PRD exactly, so porting to
  Spring Boot later is a mechanical exercise, not a redesign.

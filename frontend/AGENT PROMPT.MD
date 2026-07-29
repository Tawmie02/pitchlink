
# PitchLink - Product Requirements Document (PRD)

## 1. Product Overview

PitchLink is a mobile-first communication platform designed for grassroots sports organizers. Grassroots sports tournaments (university leagues, county sports, community tournaments) rely heavily on fragmented tools like WhatsApp groups, phone calls, and spreadsheets for match-day coordination. Critical updates are frequently missed due to poor internet access or muted groups.

PitchLink solves this by providing organizers with a centralized web dashboard to manage match-day communication using Africa's Talking (AT) APIs. It ensures players and referees receive essential updates regardless of internet connectivity through SMS, USSD, and Voice APIs.

**Hackathon Context:** This MVP is built for a hackathon demonstration. It prioritizes a polished, reliable presentation of AT API integrations over exhaustive edge-case handling.

## 2. Problem Statement

Grassroots sports organizers lack a reliable, mobile-first communication platform, forcing reliance on internet-dependent tools like WhatsApp for critical match-day communication, resulting in delays, missed updates, and operational inefficiencies.

## 3. Primary Users

* **Tournament Organizer (Primary User):** Uses the web application to create matches, manage teams, send notifications, and monitor attendance.
* **Team Captain:** Uses USSD to view match information and confirm attendance, and receives SMS reminders and Voice alerts for emergencies.
* **Referee:** Receives assignments and schedule changes via SMS/Voice and confirms availability via USSD.

## 4. MVP Scope Boundaries

**Included (Match-Day Communication Focus):**

* Dashboard overview
* Match scheduling and management
* Team and captain management
* Automated SMS notifications (AT SMS API)
* USSD interaction flow for players (AT USSD API webhook handling)
* Emergency automated voice alerts (AT Voice API)

**EXCLUDED (Do Not Build):**

* Live score tracking
* Player statistics
* League table management
* Ticketing
* Tournament bracket generation

## 5. User Journeys

**Organizer Flow (Web App):**
Login -> View Dashboard -> Create Match (Select Teams, Venue, Time) -> Send Notification (Triggers AT SMS) -> Dashboard updates with player attendance confirmations -> Trigger Emergency Voice Alert (if needed).

**Player Flow (Mobile Phone):**

* **USSD:** Dials USSD Code -> Views upcoming matches -> Selects "Confirm Attendance" -> Backend updates.
* **SMS:** Receives fixture SMS -> Reads ad-supported message -> Reads Match Details.
* **Voice:** Receives automated call -> Listens to text-to-speech cancellation alert.

## 6. MVP Features & Requirements

### 6.1 Authentication

* Simple email/password login for the Organizer.

### 6.2 Organizer Dashboard

* **Statistics Cards:** Upcoming matches, SMS Sent, Confirmed Responses, Pending Responses.
* **Today's Matches:** List of matches happening today.
* **Quick Actions:** "Create Match", "Send Update".
* **Recent Activity Feed.**

### 6.3 Match Management

* **CRUD Operations:** Create, Edit, View, Delete matches.
* **Match Details Page:**
* Fixture information (Teams, Date, Time, Venue).
* Attendance Progress Bar (Confirmed/Pending/Declined).
* Participants Table.
* Recent SMS Messages log.
* **Demo Optimization (CRITICAL):** Include a "Simulate Reply" button next to each participant to instantly mark them as "Confirmed" or "Declined" without waiting for live USSD interaction during the presentation.



### 6.4 Team Management

* **CRUD Operations:** Add, View, Edit teams.
* **Data Points:** Team Name, Captain Name, Captain Phone Number (Must use international format, e.g., +2547XXXXXXXX).

### 6.5 Africa's Talking Integrations

* **SMS API (Notifications & Monetization Strategy):**
* Triggered automatically when a match is created or updated.
* **Feature:** Append a 40-character micro-sponsorship ad at the end of every SMS (e.g., "Powered by local business X"). This handles the monetization question for grassroots organizers.


* **Voice API (Emergency Alerts):**
* Triggered via a "Cancel Match - Urgent" button on the Match Details page.
* **Feature:** Initiates an automated robocall using Text-to-Speech to notify captains of immediate cancellations (e.g., weather issues).


* **USSD API (Player Interaction Webhook):**
* The backend MUST implement a webhook endpoint (`POST /ussd`) to handle the USSD session state from the Africa's Talking Simulator.
* **Webhook Payload:** The AT API will send `sessionId`, `serviceCode`, `phoneNumber`, and `text`.
* **Response Format:** The response must be a plain text string starting with `CON` (to continue the menu) or `END` (to terminate the session).
* *Note: Do not build a USSD emulator in the frontend; we will use the live AT Sandbox Simulator side-by-side during the demo.*



## 7. Design & UI Philosophy

* **Theme:** Modern sports application. Primary color: Green (success/pitches).
* **Style:** Minimalist, soft shadows, rounded cards, large spacing (inspired by Linear/Notion).
* **Layout:** Focus on one primary task per page. Avoid clutter.
* **Components:** Use shadcn/ui components (Cards, Badges, Tables, Progress bars, Toast notifications, Modal dialogs).

## 8. Technical Stack & Implementation

* **Frontend:** React (Vite), Tailwind CSS (Dark Mode support), React Router DOM, Lucide Icons, Custom UI Primitives & Error Boundary.
* **Backend:** Node.js + Express API server with global error handling middleware.
* **Database:** SQLite (`better-sqlite3` with WAL mode & `ussd_sessions` table persistence).
* **Authentication:** JWT (JSON Web Tokens) + salted `bcryptjs` password hashing.
* **Integrations:** Africa's Talking SDK (SMS, Voice robocalls, stateful USSD Webhook) with seamless Mock Mode fallback.

## 9. Non-Functional Requirements

* **Responsiveness:** The web dashboard must work flawlessly on desktop and tablet (mobile view is a bonus, but desktop is primary for organizers).
* **State Management:** Clean, fast page loads without jarring refreshes.
* **Error Handling:** Clear toast notifications for success and error states, especially when calling external AT APIs.
* **Demo Polish:** Mock realistic data (teams, players, history) heavily so the dashboard looks populated and active during the presentation.
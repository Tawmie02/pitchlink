// ============================================================
// AFRICA'S TALKING INTEGRATION POINT: USSD webhook
// ============================================================
// >>> This endpoint must be PUBLICLY reachable for AT to call it.
// >>> Register its full public URL in your AT Sandbox dashboard:
//       Sandbox app -> USSD -> your channel -> "Callback URL"
//       e.g. https://<your-ngrok-subdomain>.ngrok-free.app/api/ussd
// >>> Test it live with the AT Simulator:
//       https://developers.africastalking.com/simulator
//     (enter your sandbox USSD service code, e.g. *384*00000#)
//
// AT sends application/x-www-form-urlencoded POST body with:
//   sessionId, serviceCode, phoneNumber, text
// `text` accumulates every input the user has typed this session,
// separated by "*". e.g. after choosing menu 1 then match 2, text = "1*2"
//
// Response MUST be plain text (Content-Type: text/plain) starting with:
//   "CON " -> keep session open, show more menu
//   "END "  -> close session
// ============================================================

import { Router } from "express";
import { db } from "../db/index.js";
import { sendSms } from "../services/africastalking.js";

const router = Router();
const ORGANIZER_PHONE = process.env.ORGANIZER_PHONE || "+254712345678";

function getRoleForPhone(phoneNumber) {
  const row = db
    .prepare(
      `SELECT role
       FROM participants
       WHERE phone = ?
       ORDER BY CASE WHEN role = 'referee' THEN 0 ELSE 1 END, id ASC
       LIMIT 1`
    )
    .get(phoneNumber);

  if (!row) return null;
  return row.role === "referee" ? "referee" : "player";
}

function getAssignedMatches(phoneNumber) {
  return db
    .prepare(
      `SELECT DISTINCT m.id, m.match_date, m.match_time, m.venue,
              ht.name AS home_team_name, at.name AS away_team_name
       FROM participants p
       JOIN matches m ON m.id = p.match_id
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE p.phone = ? AND m.status = 'scheduled'
       ORDER BY m.match_date, m.match_time`
    )
    .all(phoneNumber);
}

function getNextAssignedMatch(phoneNumber) {
  return getAssignedMatches(phoneNumber)[0] || null;
}

function getLatestUpdate(matchId) {
  const row = db
    .prepare(
      `SELECT body
       FROM messages
       WHERE match_id = ?
         AND channel = 'sms'
         AND direction = 'outbound'
         AND body NOT LIKE 'Match reminder:%'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(matchId);

  return row?.body || null;
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function renderMainMenu(role) {
  if (role === "referee") {
    return [
      "Welcome Referee ⚽",
      "",
      "1. Today's Assignment",
      "2. Confirm Availability",
      "3. Match Updates",
      "4. Contact Organizer",
      "0. Exit",
    ].join("\n");
  }

  return [
    "Welcome to PitchLink ⚽",
    "",
    "1. My Next Match",
    "2. Confirm Attendance",
    "3. Match Updates",
    "4. Contact Organizer",
    "0. Exit",
  ].join("\n");
}

function renderMatchList(matches, title) {
  return [
    title,
    "",
    ...matches.map((match, index) => `${index + 1}. ${match.home_team_name} vs ${match.away_team_name}`),
    "",
    "0. Back",
  ].join("\n");
}

function renderMatchDetail(match, title) {
  return [
    title,
    "",
    match.home_team_name,
    "vs",
    match.away_team_name,
    "",
    `📅 ${formatDate(match.match_date)}`,
    `🕙 ${formatTime(match.match_time)}`,
    `📍 ${match.venue}`,
    "",
    "0. Back",
  ].join("\n");
}

function renderConfirmMenu(match, title) {
  return [
    title,
    "",
    match.home_team_name,
    "vs",
    match.away_team_name,
    "",
    "1. Yes",
    "2. No",
    "0. Back",
  ].join("\n");
}

function renderContactOrganizer() {
  return [
    "Tournament Organizer",
    "",
    `📞 ${ORGANIZER_PHONE}`,
    "",
    "Need assistance?",
    "Call or SMS.",
    "",
    "0. Back",
  ].join("\n");
}

router.post("/", (req, res) => {
  const { sessionId, phoneNumber, text = "" } = req.body;
  res.set("Content-Type", "text/plain");

  const inputs = text.split("*").filter(Boolean);
  const level = inputs.length;
  const role = getRoleForPhone(phoneNumber);

  try {
    if (!role) {
      return res.send(
        [
          "END Welcome to PitchLink",
          "",
          "Your phone number is not registered.",
          "Please contact your tournament organizer.",
          "",
          "0. Exit",
        ].join("\n")
      );
    }

    if (level === 0) {
      return res.send(`CON ${renderMainMenu(role)}`);
    }

    if (inputs[0] === "0") {
      return res.send("END Thanks for using PitchLink.");
    }

    if (inputs[inputs.length - 1] === "0") {
      return res.send(`CON ${renderMainMenu(role)}`);
    }

    const matches = getAssignedMatches(phoneNumber);
    const nextMatch = getNextAssignedMatch(phoneNumber);

    if (inputs[0] === "1") {
      if (matches.length === 0) {
        return res.send("END You have no upcoming matches.");
      }

      if (matches.length > 1 && level === 1) {
        return res.send(`CON ${renderMatchList(matches, role === "referee" ? "Today's Assignments" : "Upcoming Matches")}`);
      }

      const selectedMatch = matches.length > 1 && level >= 2 ? matches[Number(inputs[1]) - 1] : nextMatch;
      if (!selectedMatch) {
        return res.send("END Invalid selection. Please try again.");
      }

      return res.send(
        `CON ${renderMatchDetail(selectedMatch, role === "referee" ? "Today's Match" : "Next Match")}`
      );
    }

    if (inputs[0] === "2") {
      if (matches.length === 0) {
        return res.send("END You have no upcoming matches to confirm.");
      }

      const selectedMatch = matches.length > 1 && level === 1 ? null : matches.length > 1 ? matches[Number(inputs[1]) - 1] : nextMatch;

      if (!selectedMatch) {
        return res.send(`CON ${renderMatchList(matches, role === "referee" ? "Select Assignment" : "Select Match")}`);
      }

      if (matches.length > 1 && level === 2 && !selectedMatch) {
        return res.send("END Invalid selection. Please try again.");
      }

      if (level === (matches.length > 1 ? 2 : 1)) {
        return res.send(
          `CON ${renderConfirmMenu(
            selectedMatch,
            role === "referee" ? "Can you officiate?" : "Confirm Attendance"
          )}`
        );
      }

      const choice = inputs[matches.length > 1 ? 2 : 1];
      const newStatus = choice === "1" ? "confirmed" : choice === "2" ? "declined" : null;
      if (!newStatus) return res.send("END Invalid choice.");

      const participant = db
        .prepare("SELECT * FROM participants WHERE match_id = ? AND phone = ?")
        .get(selectedMatch.id, phoneNumber);

      if (participant) {
        db.prepare(
          "UPDATE participants SET status = ?, responded_at = datetime('now') WHERE id = ?"
        ).run(newStatus, participant.id);

        db.prepare(
          `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, provider_ref)
           VALUES (?, ?, 'ussd', 'inbound', ?, 'received', ?)`
        ).run(selectedMatch.id, participant.id, `USSD reply: ${newStatus}`, sessionId);

        const participantMessage =
          newStatus === "confirmed"
            ? "✅ Thanks!\n\nYour attendance has been confirmed.\n\nSee you at the match."
            : "❌ Attendance Declined.\n\nOrganizer has been notified.";

        void sendSms(participant.phone, participantMessage).catch((err) => {
          console.error("[USSD SMS] participant confirmation failed:", err.message);
        });

        const organizerMessage =
          role === "referee"
            ? `🏆 PitchLink\n\nReferee update:\n${participant.name} ${newStatus === "confirmed" ? "accepted" : "declined"} the assignment for ${selectedMatch.home_team_name} vs ${selectedMatch.away_team_name}.\n\n📅 ${formatDate(selectedMatch.match_date)}\n🕙 ${formatTime(selectedMatch.match_time)}`
            : `🏆 PitchLink\n\nAttendance update:\n${participant.name} ${newStatus === "confirmed" ? "confirmed" : "declined"} attendance for ${selectedMatch.home_team_name} vs ${selectedMatch.away_team_name}.\n\n📅 ${formatDate(selectedMatch.match_date)}\n🕙 ${formatTime(selectedMatch.match_time)}`;

        void sendSms(ORGANIZER_PHONE, organizerMessage).catch((err) => {
          console.error("[USSD SMS] organizer notification failed:", err.message);
        });
      }

      return res.send(
        newStatus === "confirmed"
          ? "END ✅ Attendance Confirmed.\n\nYour organizer has been notified.\n\n0. Main Menu"
          : "END ❌ Attendance Declined.\n\nOrganizer has been notified.\n\n0. Main Menu"
      );
    }

    if (inputs[0] === "3") {
      const targetMatch = nextMatch;
      if (!targetMatch) {
        return res.send("END No new match updates.");
      }

      const update = getLatestUpdate(targetMatch.id);
      if (!update) {
        return res.send("CON No new match updates.\n\n0. Back");
      }

      return res.send(`CON Latest Update\n\n${update}\n\n0. Back`);
    }

    if (inputs[0] === "4") {
      return res.send(`CON ${renderContactOrganizer()}`);
    }

    return res.send("END Invalid option.");
  } catch (err) {
    console.error("[USSD] error:", err);
    return res.send("END Sorry, something went wrong. Please try again later.");
  }
});

export default router;

// ============================================================
// AFRICA'S TALKING INTEGRATION POINT: USSD webhook
// ============================================================
// >>> This endpoint must be PUBLICLY reachable for AT to call it.
// >>> Register its full public URL in your AT Sandbox dashboard:
//       Sandbox app -> USSD -> your channel -> "Callback URL"
//       e.g. https://unearth-juvenile-reason.ngrok-free.dev/api/ussd
// >>> Test it live with the AT Simulator:
//       https://developers.africastalking.com/simulator
//     (enter your sandbox USSD service code, e.g. *384*00000#)
// ============================================================

import { Router } from "express";
import { db } from "../db/index.js";
import { sendSms } from "../services/africastalking.js";
import { normalizePhone } from "../lib/phone.js";

const router = Router();
const ORGANIZER_PHONE = process.env.ORGANIZER_PHONE || "+254712345678";

function getPhoneProfile(phoneNumber) {
  const normPhone = normalizePhone(phoneNumber);
  const participant = db
    .prepare(
      `SELECT role, team_id, name, phone
       FROM participants
       WHERE phone = ?
       ORDER BY CASE
         WHEN role IN ('referee', 'assistant_referee') THEN 0
         WHEN role IN ('manager', 'coach', 'stakeholder') THEN 1
         WHEN role = 'captain' THEN 2
         ELSE 3
       END, id ASC
       LIMIT 1`
    )
    .get(normPhone);

  if (participant) return { ...participant, roleLabel: participant.role };

  const teamContact = db
    .prepare(
      `SELECT tc.role, tc.team_id, tc.name, tc.phone
       FROM team_contacts tc
       WHERE tc.phone = ?
       ORDER BY CASE
         WHEN tc.role IN ('referee', 'assistant_referee') THEN 0
         WHEN tc.role IN ('manager', 'coach', 'stakeholder') THEN 1
         WHEN tc.role = 'captain' THEN 2
         ELSE 3
       END, tc.id ASC
       LIMIT 1`
    )
    .get(normPhone);

  if (teamContact) return { ...teamContact, roleLabel: teamContact.role };

  return null;
}

function getAssignedMatches(phoneNumber) {
  const normPhone = normalizePhone(phoneNumber);
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
    .all(normPhone);
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
      "Welcome Main Referee ⚽",
      "",
      "1. Today's Assignment",
      "2. Confirm Availability",
      "3. Match Updates",
      "4. Contact Organizer",
      "0. Exit",
    ].join("\n");
  }

  if (role === "assistant_referee") {
    return [
      "Welcome Linesman ⚽",
      "",
      "1. Today's Assignment",
      "2. Confirm Availability",
      "3. Match Updates",
      "4. Contact Organizer",
      "0. Exit",
    ].join("\n");
  }

  if (["manager", "coach", "stakeholder", "captain"].includes(role)) {
    return [
      `Welcome ${role.charAt(0).toUpperCase() + role.slice(1)} ⚽`,
      "",
      "1. My Next Match",
      "2. Confirm Attendance",
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

function renderMatchList(matches, title, page = 0, pageSize = 3) {
  const totalPages = Math.ceil(matches.length / pageSize);
  const startIndex = page * pageSize;
  const pageMatches = matches.slice(startIndex, startIndex + pageSize);

  const lines = [title, ""];
  pageMatches.forEach((match, idx) => {
    const itemNum = startIndex + idx + 1;
    lines.push(`${itemNum}. ${match.home_team_name} vs ${match.away_team_name}`);
  });
  lines.push("");

  if (page < totalPages - 1) lines.push("99. Next Page");
  if (page > 0) lines.push("88. Prev Page");
  lines.push("0. Back");

  return lines.join("\n");
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

function renderContactOrganizer(phoneNumber) {
  const profile = getPhoneProfile(phoneNumber);
  const contact = profile?.team_id
    ? db
        .prepare(
          `SELECT name, phone, role
           FROM team_contacts
           WHERE team_id = ?
             AND role IN ('manager', 'coach', 'stakeholder', 'captain')
           ORDER BY CASE
             WHEN role = 'manager' THEN 0
             WHEN role = 'coach' THEN 1
             WHEN role = 'stakeholder' THEN 2
             WHEN role = 'captain' THEN 3
             ELSE 4
           END, id ASC
           LIMIT 1`
        )
        .get(profile.team_id)
    : null;

  return [
    "Tournament Organizer",
    "",
    `📞 ${contact?.phone || ORGANIZER_PHONE}`,
    "",
    "Need assistance?",
    "Call or SMS.",
    "",
    "0. Back",
  ].join("\n");
}

function updateSession(sessionId, step, matchId = null) {
  db.prepare(
    "UPDATE ussd_sessions SET step = ?, match_id = ?, updated_at = datetime('now') WHERE session_id = ?"
  ).run(step, matchId, sessionId);
}

function deleteSession(sessionId) {
  db.prepare("DELETE FROM ussd_sessions WHERE session_id = ?").run(sessionId);
}

router.post("/", (req, res) => {
  const { sessionId, phoneNumber, text = "" } = req.body;
  res.set("Content-Type", "text/plain");

  const normPhone = normalizePhone(phoneNumber);
  const profile = getPhoneProfile(normPhone);
  const role = profile?.roleLabel || null;

  try {
    if (!role) {
      return res.send(
        [
          "END Welcome to PitchLink",
          "",
          "Your phone number is not registered.",
          "Please contact your tournament organizer.",
        ].join("\n")
      );
    }

    const inputs = text.split("*").filter(Boolean);
    const lastInput = inputs.length > 0 ? inputs[inputs.length - 1] : "";

    if (!text || text.trim() === "") {
      db.prepare("INSERT OR REPLACE INTO ussd_sessions (session_id, phone_number, step) VALUES (?, ?, 'root')").run(sessionId, normPhone);
      return res.send(`CON ${renderMainMenu(role)}`);
    }

    let session = db.prepare("SELECT * FROM ussd_sessions WHERE session_id = ?").get(sessionId);
    if (!session) {
      db.prepare("INSERT INTO ussd_sessions (session_id, phone_number, step) VALUES (?, ?, 'root')").run(sessionId, normPhone);
      session = { session_id: sessionId, phone_number: normPhone, step: "root", match_id: null };
    }

    // Handle '0' input (Back to main menu or Exit)
    if (lastInput === "0") {
      if (session.step === "root") {
        deleteSession(sessionId);
        return res.send("END Thanks for using PitchLink.");
      }
      updateSession(sessionId, "root", null);
      return res.send(`CON ${renderMainMenu(role)}`);
    }

    const matches = getAssignedMatches(normPhone);
    const nextMatch = getNextAssignedMatch(normPhone);

    const isRef = role === "referee" || role === "assistant_referee";

    if (session.step === "root") {
      if (lastInput === "1") {
        if (matches.length === 0) {
          deleteSession(sessionId);
          return res.send("END You have no upcoming matches.");
        }
        if (matches.length > 1) {
          updateSession(sessionId, "select_match_view_page_0", null);
          return res.send(`CON ${renderMatchList(matches, isRef ? "Today's Assignments" : "Upcoming Matches", 0)}`);
        }
        updateSession(sessionId, "view_match_detail", matches[0].id);
        return res.send(`CON ${renderMatchDetail(matches[0], isRef ? "Today's Match" : "Next Match")}`);
      }

      if (lastInput === "2") {
        if (matches.length === 0) {
          deleteSession(sessionId);
          return res.send("END You have no upcoming matches to confirm.");
        }
        if (matches.length > 1) {
          updateSession(sessionId, "select_match_confirm_page_0", null);
          return res.send(`CON ${renderMatchList(matches, isRef ? "Select Assignment" : "Select Match", 0)}`);
        }
        updateSession(sessionId, "confirm_choice", matches[0].id);
        return res.send(`CON ${renderConfirmMenu(matches[0], isRef ? "Can you officiate?" : "Confirm Attendance")}`);
      }

      if (lastInput === "3") {
        if (!nextMatch) {
          deleteSession(sessionId);
          return res.send("END No new match updates.");
        }
        const update = getLatestUpdate(nextMatch.id);
        if (!update) {
          return res.send("CON No new match updates.\n\n0. Back");
        }
        return res.send(`CON Latest Update\n\n${update}\n\n0. Back`);
      }

      if (lastInput === "4") {
        return res.send(`CON ${renderContactOrganizer(normPhone)}`);
      }

      return res.send("END Invalid option.");
    }

    // Handles match view pagination & selection
    if (session.step.startsWith("select_match_view")) {
      let page = Number(session.step.split("_").pop()) || 0;
      if (lastInput === "99") page += 1;
      else if (lastInput === "88" && page > 0) page -= 1;
      else {
        const selectedIdx = Number(lastInput) - 1;
        const selectedMatch = matches[selectedIdx];
        if (selectedMatch) {
          updateSession(sessionId, "view_match_detail", selectedMatch.id);
          return res.send(`CON ${renderMatchDetail(selectedMatch, isRef ? "Today's Match" : "Match Details")}`);
        }
      }
      updateSession(sessionId, `select_match_view_page_${page}`, null);
      return res.send(`CON ${renderMatchList(matches, isRef ? "Today's Assignments" : "Upcoming Matches", page)}`);
    }

    // Handles match confirmation pagination & selection
    if (session.step.startsWith("select_match_confirm")) {
      let page = Number(session.step.split("_").pop()) || 0;
      if (lastInput === "99") page += 1;
      else if (lastInput === "88" && page > 0) page -= 1;
      else {
        const selectedIdx = Number(lastInput) - 1;
        const selectedMatch = matches[selectedIdx];
        if (selectedMatch) {
          updateSession(sessionId, "confirm_choice", selectedMatch.id);
          return res.send(`CON ${renderConfirmMenu(selectedMatch, isRef ? "Can you officiate?" : "Confirm Attendance")}`);
        }
      }
      updateSession(sessionId, `select_match_confirm_page_${page}`, null);
      return res.send(`CON ${renderMatchList(matches, isRef ? "Select Assignment" : "Select Match", page)}`);
    }

    if (session.step === "confirm_choice") {
      const selectedMatch = (session.match_id
        ? db.prepare(
            `SELECT m.*, ht.name AS home_team_name, at.name AS away_team_name
             FROM matches m
             JOIN teams ht ON ht.id = m.home_team_id
             JOIN teams at ON at.id = m.away_team_id
             WHERE m.id = ?`
          ).get(session.match_id)
        : null) || nextMatch;

      const newStatus = lastInput === "1" ? "confirmed" : lastInput === "2" ? "declined" : null;
      if (!newStatus) {
        return res.send("CON Invalid choice. Press 1 for Yes, 2 for No.\n\n0. Back");
      }

      if (selectedMatch) {
        const participant = db
          .prepare("SELECT * FROM participants WHERE match_id = ? AND phone = ?")
          .get(selectedMatch.id, normPhone);

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

          const organizerMessage = isRef
            ? `🏆 PitchLink\n\nOfficiating update:\n${participant.name} (${participant.role === 'assistant_referee' ? 'Linesman' : 'Main Referee'}) ${newStatus === "confirmed" ? "accepted" : "declined"} assignment for ${selectedMatch.home_team_name} vs ${selectedMatch.away_team_name}.\n\n📅 ${formatDate(selectedMatch.match_date)}\n🕙 ${formatTime(selectedMatch.match_time)}`
            : `🏆 PitchLink\n\nAttendance update:\n${participant.name} ${newStatus === "confirmed" ? "confirmed" : "declined"} attendance for ${selectedMatch.home_team_name} vs ${selectedMatch.away_team_name}.\n\n📅 ${formatDate(selectedMatch.match_date)}\n🕙 ${formatTime(selectedMatch.match_time)}`;

          void sendSms(ORGANIZER_PHONE, organizerMessage).catch((err) => {
            console.error("[USSD SMS] organizer notification failed:", err.message);
          });
        }
      }

      deleteSession(sessionId);
      return res.send(
        newStatus === "confirmed"
          ? "END ✅ Attendance Confirmed.\n\nYour organizer has been notified."
          : "END ❌ Attendance Declined.\n\nOrganizer has been notified."
      );
    }

    return res.send("END Invalid state.");
  } catch (err) {
    console.error("[USSD] error:", err);
    return res.send("END Sorry, something went wrong. Please try again later.");
  }
});

export default router;

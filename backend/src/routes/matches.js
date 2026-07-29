import { Router } from "express";
import { db } from "../db/index.js";
import { sendSms, triggerVoiceAlert } from "../services/africastalking.js";

const router = Router();

function getTeamContacts(teamId) {
  return db
    .prepare("SELECT name, phone, role, team_id FROM team_contacts WHERE team_id = ? ORDER BY id ASC")
    .all(teamId);
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

function buildReminderMessage(match) {
  return [
    "🏆 PitchLink",
    "",
    "Reminder:",
    `${match.home_team_name} vs ${match.away_team_name}`,
    "",
    `📅 ${formatDate(match.match_date)}`,
    `🕙 ${formatTime(match.match_time)}`,
    `📍 ${match.venue}`,
    "",
    "Reply YES to confirm attendance.",
  ].join("\n");
}

function buildMatchUpdateMessage(before, after) {
  const lines = ["⚠️ Match Update", ""];

  if (before.venue !== after.venue) {
    lines.push("Venue changed to:", after.venue, "");
  }

  if (before.match_time !== after.match_time) {
    lines.push(`Kickoff updated to: ${formatTime(after.match_time)}`, "");
  }

  if (before.match_date !== after.match_date) {
    lines.push(`Date updated to: ${formatDate(after.match_date)}`, "");
  }

  if (before.status !== after.status && after.status === "cancelled") {
    lines.push("Match cancelled.", "");
  }

  if (lines.length === 2) {
    return null;
  }

  lines.push("Please check the PitchLink dashboard for details.");
  return lines.join("\n");
}

function syncMatchRoster(matchId) {
  const match = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId);
  if (!match) return null;

  const contacts = [...getTeamContacts(match.home_team_id), ...getTeamContacts(match.away_team_id)];
  const participantLookup = db.prepare(
    `SELECT id
     FROM participants
     WHERE match_id = ?
       AND team_id = ?
       AND phone = ?
       AND role = ?`
  );
  const nameLookup = db.prepare(
    `SELECT id
     FROM participants
     WHERE match_id = ?
       AND team_id = ?
       AND name = ?
       AND role = ?`
  );
  const insertParticipant = db.prepare(
    `INSERT INTO participants (match_id, team_id, name, phone, role)
     VALUES (?, ?, ?, ?, ?)`
  );
  const updateParticipant = db.prepare(
    `UPDATE participants SET name = ?, phone = ?, role = ?, team_id = ? WHERE id = ?`
  );

  for (const contact of contacts) {
    const exactMatch =
      participantLookup.get(matchId, match.home_team_id, contact.phone, contact.role) ||
      participantLookup.get(matchId, match.away_team_id, contact.phone, contact.role);
    if (exactMatch) continue;

    const renamed =
      nameLookup.get(matchId, match.home_team_id, contact.name, contact.role) ||
      nameLookup.get(matchId, match.away_team_id, contact.name, contact.role);
    if (renamed) {
      updateParticipant.run(contact.name, contact.phone, contact.role || "member", contact.team_id || match.home_team_id, renamed.id);
      continue;
    }

    insertParticipant.run(matchId, contact.team_id || match.home_team_id, contact.name, contact.phone, contact.role || "member");
  }

  return match;
}

function getMatchWithDetails(matchId) {
  syncMatchRoster(matchId);

  const match = db
    .prepare(
      `SELECT m.*, 
              ht.name AS home_team_name, ht.captain_name AS home_captain, ht.captain_phone AS home_phone,
              at.name AS away_team_name, at.captain_name AS away_captain, at.captain_phone AS away_phone
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.id = ?`
    )
    .get(matchId);

  if (!match) return null;

  const participants = db
    .prepare("SELECT * FROM participants WHERE match_id = ? ORDER BY role, name")
    .all(matchId);
  const messages = db
    .prepare("SELECT * FROM messages WHERE match_id = ? ORDER BY created_at DESC")
    .all(matchId);

  return { ...match, participants, messages };
}

// --- Dashboard summary ---
router.get("/stats/summary", (req, res) => {
  const upcoming = db
    .prepare("SELECT COUNT(*) c FROM matches WHERE status = 'scheduled'")
    .get().c;
  const smsSent = db
    .prepare("SELECT COUNT(*) c FROM messages WHERE channel = 'sms' AND direction = 'outbound'")
    .get().c;
  const confirmed = db
    .prepare("SELECT COUNT(*) c FROM participants WHERE status = 'confirmed'")
    .get().c;
  const pending = db
    .prepare("SELECT COUNT(*) c FROM participants WHERE status = 'pending'")
    .get().c;

  const today = new Date().toISOString().slice(0, 10);
  const todaysMatches = db
    .prepare(
      `SELECT m.*, ht.name AS home_team_name, at.name AS away_team_name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.match_date = ?
       ORDER BY m.match_time`
    )
    .all(today);

  const recentActivity = db
    .prepare(
      `SELECT msg.*, m.venue, m.match_date
       FROM messages msg
       LEFT JOIN matches m ON m.id = msg.match_id
       ORDER BY msg.created_at DESC LIMIT 10`
    )
    .all();

  res.json({ upcoming, smsSent, confirmed, pending, todaysMatches, recentActivity });
});

router.get("/", (req, res) => {
  const matches = db
    .prepare(
      `SELECT m.*, ht.name AS home_team_name, at.name AS away_team_name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       ORDER BY m.match_date, m.match_time`
    )
    .all();
  res.json(matches);
});

router.get("/:id", (req, res) => {
  const match = getMatchWithDetails(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json(match);
});

router.post("/", (req, res) => {
  const { home_team_id, away_team_id, venue, match_date, match_time, referee_name, referee_phone } = req.body;
  if (!home_team_id || !away_team_id || !venue || !match_date || !match_time) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (home_team_id === away_team_id) {
    return res.status(400).json({ error: "Home and away team must be different" });
  }

  const result = db
    .prepare(
      `INSERT INTO matches (home_team_id, away_team_id, venue, match_date, match_time)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(home_team_id, away_team_id, venue, match_date, match_time);
  const matchId = result.lastInsertRowid;

  // Auto-add all stored team contacts as participants for this match
  const homeTeam = db.prepare("SELECT * FROM teams WHERE id = ?").get(home_team_id);
  const awayTeam = db.prepare("SELECT * FROM teams WHERE id = ?").get(away_team_id);
  const homeContacts = db
    .prepare("SELECT name, phone, role FROM team_contacts WHERE team_id = ? ORDER BY role, name")
    .all(home_team_id);
  const awayContacts = db
    .prepare("SELECT name, phone, role FROM team_contacts WHERE team_id = ? ORDER BY role, name")
    .all(away_team_id);
  const insertParticipant = db.prepare(
    `INSERT INTO participants (match_id, team_id, name, phone, role) VALUES (?, ?, ?, ?, ?)`
  );

  if (homeContacts.length > 0) {
    for (const contact of homeContacts) {
      insertParticipant.run(matchId, home_team_id, contact.name, contact.phone, contact.role || "member");
    }
  } else {
    insertParticipant.run(matchId, home_team_id, homeTeam.captain_name, homeTeam.captain_phone, "captain");
  }

  if (awayContacts.length > 0) {
    for (const contact of awayContacts) {
      insertParticipant.run(matchId, away_team_id, contact.name, contact.phone, contact.role || "member");
    }
  } else {
    insertParticipant.run(matchId, away_team_id, awayTeam.captain_name, awayTeam.captain_phone, "captain");
  }

  // Add Primary Referee & Assistant Referees
  const refName = referee_name || "Referee James Mwangi";
  const refPhone = referee_phone || "+254722000099";
  insertParticipant.run(matchId, null, refName, refPhone, "referee");
  insertParticipant.run(matchId, null, "Linesman Peter Omondi", "+254722000088", "assistant_referee");
  insertParticipant.run(matchId, null, "Linesman Kevin Mutua", "+254722000077", "assistant_referee");

  res.status(201).json(getMatchWithDetails(matchId));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM matches WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Match not found" });
  const { venue, match_date, match_time, status, send_sms_update = true } = req.body;
  db.prepare(
    "UPDATE matches SET venue = ?, match_date = ?, match_time = ?, status = ? WHERE id = ?"
  ).run(
    venue ?? existing.venue,
    match_date ?? existing.match_date,
    match_time ?? existing.match_time,
    status ?? existing.status,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM matches WHERE id = ?").get(req.params.id);
  const updateMessage = buildMatchUpdateMessage(existing, updated);
  if (updateMessage && send_sms_update) {
    syncMatchRoster(req.params.id);
    const participants = db.prepare("SELECT * FROM participants WHERE match_id = ?").all(req.params.id);
    for (const participant of participants) {
      void sendSms(participant.phone, updateMessage).then(({ status, providerRef, body }) => {
        db.prepare(
          `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, provider_ref)
           VALUES (?, ?, 'sms', 'outbound', ?, ?, ?)`
        ).run(req.params.id, participant.id, body, status, providerRef);
      }).catch((err) => {
        console.error("[MATCH UPDATE SMS] failed:", err.message);
      });
    }
  }

  res.json(getMatchWithDetails(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM matches WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

// --- Africa's Talking: SMS notification ---
router.post("/:id/notify", async (req, res) => {
  const match = getMatchWithDetails(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const { message, participant_id } = req.body;
  const messageText = message || buildReminderMessage(match);

  const targetParticipants = participant_id
    ? match.participants.filter((p) => String(p.id) === String(participant_id))
    : match.participants;

  if (targetParticipants.length === 0) {
    return res.status(400).json({ error: "No matching participants found to notify" });
  }

  const results = [];
  for (const participant of targetParticipants) {
    const { status, providerRef, body } = await sendSms(participant.phone, messageText);
    db.prepare(
      `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, provider_ref)
       VALUES (?, ?, 'sms', 'outbound', ?, ?, ?)`
    ).run(match.id, participant.id, body, status, providerRef);
    results.push({ participant: participant.name, phone: participant.phone, status });
  }

  res.json({ sent: results.length, results });
});

// --- Africa's Talking: Voice emergency cancellation alert ---
router.post("/:id/cancel-alert", async (req, res) => {
  const match = getMatchWithDetails(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  db.prepare("UPDATE matches SET status = 'cancelled' WHERE id = ?").run(match.id);

  const reason = req.body.reason || "unforeseen circumstances";
  const ttsMessage = `Urgent alert. The match between ${match.home_team_name} and ${match.away_team_name} scheduled at ${match.venue} has been cancelled due to ${reason}. Please inform your team.`;

  const results = [];
  for (const participant of match.participants) {
    // 1. Pre-insert record to prevent race condition when AT hits /api/voice/events
    const insertResult = db.prepare(
      `INSERT INTO messages (match_id, participant_id, channel, direction, body, status)
       VALUES (?, ?, 'voice', 'outbound', ?, 'pending')`
    ).run(match.id, participant.id, ttsMessage);
    const msgId = insertResult.lastInsertRowid;

    // 2. Trigger voice robocall via AT API
    const { status, providerRef } = await triggerVoiceAlert(participant.phone, ttsMessage);

    // 3. Update record with actual provider reference and status
    db.prepare(
      `UPDATE messages SET status = ?, provider_ref = ? WHERE id = ?`
    ).run(status, providerRef, msgId);

    results.push({ participant: participant.name, phone: participant.phone, status });
  }

  res.json({ cancelled: true, called: results.length, results });
});

// --- Demo optimization: simulate a participant's USSD/SMS reply instantly ---
router.post("/:matchId/participants/:participantId/simulate-reply", (req, res) => {
  const { status } = req.body; // "confirmed" | "declined"
  if (!["confirmed", "declined"].includes(status)) {
    return res.status(400).json({ error: "status must be 'confirmed' or 'declined'" });
  }
  db.prepare(
    "UPDATE participants SET status = ?, responded_at = datetime('now') WHERE id = ? AND match_id = ?"
  ).run(status, req.params.participantId, req.params.matchId);

  const participant = db
    .prepare("SELECT * FROM participants WHERE id = ?")
    .get(req.params.participantId);

  db.prepare(
    `INSERT INTO messages (match_id, participant_id, channel, direction, body, status)
     VALUES (?, ?, 'sms', 'inbound', ?, 'simulated')`
  ).run(req.params.matchId, participant.id, status.toUpperCase());

  res.json(participant);
});

export default router;

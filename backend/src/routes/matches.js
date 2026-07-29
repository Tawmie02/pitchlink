import { Router } from "express";
import { db } from "../db/index.js";
import { sendSms, triggerVoiceAlert } from "../services/africastalking.js";

const router = Router();

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

function getMatchWithDetails(matchId) {
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
  const { home_team_id, away_team_id, venue, match_date, match_time } = req.body;
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

  // Auto-add captains + a default referee slot as participants
  const homeTeam = db.prepare("SELECT * FROM teams WHERE id = ?").get(home_team_id);
  const awayTeam = db.prepare("SELECT * FROM teams WHERE id = ?").get(away_team_id);
  const insertParticipant = db.prepare(
    `INSERT INTO participants (match_id, team_id, name, phone, role) VALUES (?, ?, ?, ?, ?)`
  );
  insertParticipant.run(matchId, home_team_id, homeTeam.captain_name, homeTeam.captain_phone, "captain");
  insertParticipant.run(matchId, away_team_id, awayTeam.captain_name, awayTeam.captain_phone, "captain");

  res.status(201).json(getMatchWithDetails(matchId));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM matches WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Match not found" });
  const { venue, match_date, match_time, status } = req.body;
  db.prepare(
    "UPDATE matches SET venue = ?, match_date = ?, match_time = ?, status = ? WHERE id = ?"
  ).run(
    venue ?? existing.venue,
    match_date ?? existing.match_date,
    match_time ?? existing.match_time,
    status ?? existing.status,
    req.params.id
  );
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

  const messageText =
    req.body.message ||
    buildReminderMessage(match);

  const results = [];
  for (const participant of match.participants) {
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
    const { status, providerRef } = await triggerVoiceAlert(participant.phone, ttsMessage);
    db.prepare(
      `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, provider_ref)
       VALUES (?, ?, 'voice', 'outbound', ?, ?, ?)`
    ).run(match.id, participant.id, ttsMessage, status, providerRef);
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

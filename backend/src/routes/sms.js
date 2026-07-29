// ============================================================
// AFRICA'S TALKING INTEGRATION POINT: SMS webhooks
// ============================================================
// Incoming Messages  -> POST /api/sms/inbound
// Delivery Reports   -> POST /api/sms/delivery
// Configure both URLs in the Africa's Talking dashboard so the MVP can
// record inbound replies and update delivery status in the UI.
// ============================================================

import { Router } from "express";
import { db } from "../db/index.js";
import { sendSms } from "../services/africastalking.js";
import { normalizePhone } from "../lib/phone.js";

const router = Router();
const ORGANIZER_PHONE = process.env.ORGANIZER_PHONE || "+254712345678";

function normalizeText(text = "") {
  return String(text).trim().toLowerCase();
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

function getActiveAssignment(phoneNumber) {
  const normalized = normalizePhone(phoneNumber);
  return db
    .prepare(
      `SELECT p.*, m.id AS match_id, m.match_date, m.match_time, m.venue,
              ht.name AS home_team_name, at.name AS away_team_name
       FROM participants p
       JOIN matches m ON m.id = p.match_id
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE p.phone = ?
         AND m.status = 'scheduled'
       ORDER BY CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END,
                m.match_date,
                m.match_time,
                p.id DESC
       LIMIT 1`
    )
    .get(normalized);
}

function insertMessage({ matchId, participantId, channel, direction, body, status, providerRef }) {
  db.prepare(
    `INSERT INTO messages (match_id, participant_id, channel, direction, body, status, provider_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(matchId, participantId, channel, direction, body, status, providerRef || null);
}

function buildAckMessage(accepted) {
  if (accepted) {
    return [
      "✅ Thanks!",
      "",
      "Your attendance has been confirmed.",
      "",
      "See you at the match.",
    ].join("\n");
  }

  return [
    "❌ Attendance Declined.",
    "",
    "Organizer has been notified.",
  ].join("\n");
}

function buildGuidanceMessage(assignment) {
  const rolePrompt = assignment.role === "referee"
    ? "Reply YES to accept the assignment or NO to decline."
    : "Reply YES to confirm attendance or NO to decline.";

  return [
    `PitchLink: ${assignment.home_team_name} vs ${assignment.away_team_name}`,
    "",
    rolePrompt,
  ].join("\n");
}

function buildOrganizerMessage(assignment, accepted) {
  return [
    "🏆 PitchLink",
    "",
    accepted ? "Attendance confirmed" : "Attendance declined",
    "",
    `${assignment.name}`,
    `${assignment.home_team_name} vs ${assignment.away_team_name}`,
    "",
    `📅 ${formatDate(assignment.match_date)}`,
    `🕙 ${formatTime(assignment.match_time)}`,
    `📍 ${assignment.venue}`,
  ].join("\n");
}

function buildUnknownMessage() {
  return [
    "Welcome to PitchLink",
    "",
    "Your phone number is not registered.",
    "Please contact your tournament organizer.",
  ].join("\n");
}

function normalizeDeliveryStatus(status = "") {
  const value = String(status).trim().toLowerCase();
  if (value === "success") return "delivered";
  if (value === "sent" || value === "submitted" || value === "buffered") return value;
  if (value === "rejected" || value === "failed" || value === "expired") return value;
  return value || "delivered";
}

router.post("/inbound", async (req, res) => {
  const rawFrom = req.body.from || req.body.phoneNumber || "";
  const from = normalizePhone(rawFrom);
  const text = normalizeText(req.body.text || "");
  const messageId = req.body.id || req.body.messageId || null;
  const assignment = getActiveAssignment(from);

  if (!assignment) {
    insertMessage({
      matchId: null,
      participantId: null,
      channel: "sms",
      direction: "inbound",
      body: req.body.text || "",
      status: "unregistered",
      providerRef: messageId,
    });

    const fallback = await sendSms(from, buildUnknownMessage());
    insertMessage({
      matchId: null,
      participantId: null,
      channel: "sms",
      direction: "outbound",
      body: fallback.body,
      status: fallback.status,
      providerRef: fallback.providerRef,
    });

    res.type("text/plain").send("OK");
    return;
  }

  const accepted = ["yes", "y", "1", "confirm", "confirmed", "accept", "accepted"].includes(text);
  const declined = ["no", "n", "2", "decline", "declined", "reject", "rejected"].includes(text);

  insertMessage({
    matchId: assignment.match_id,
    participantId: assignment.id,
    channel: "sms",
    direction: "inbound",
    body: req.body.text || "",
    status: "received",
    providerRef: messageId,
  });

  if (!accepted && !declined) {
    const guidance = await sendSms(from, buildGuidanceMessage(assignment));
    insertMessage({
      matchId: assignment.match_id,
      participantId: assignment.id,
      channel: "sms",
      direction: "outbound",
      body: guidance.body,
      status: guidance.status,
      providerRef: guidance.providerRef,
    });

    res.type("text/plain").send("OK");
    return;
  }

  const newStatus = accepted ? "confirmed" : "declined";
  db.prepare(
    "UPDATE participants SET status = ?, responded_at = datetime('now') WHERE id = ?"
  ).run(newStatus, assignment.id);

  const participantAck = await sendSms(from, buildAckMessage(accepted));
  insertMessage({
    matchId: assignment.match_id,
    participantId: assignment.id,
    channel: "sms",
    direction: "outbound",
    body: participantAck.body,
    status: participantAck.status,
    providerRef: participantAck.providerRef,
  });

  const organizerAck = await sendSms(ORGANIZER_PHONE, buildOrganizerMessage(assignment, accepted));
  insertMessage({
    matchId: assignment.match_id,
    participantId: assignment.id,
    channel: "sms",
    direction: "outbound",
    body: organizerAck.body,
    status: organizerAck.status,
    providerRef: organizerAck.providerRef,
  });

  res.type("text/plain").send("OK");
});

router.post("/delivery", (req, res) => {
  const deliveryId = req.body.id || req.body.messageId || null;
  const status = normalizeDeliveryStatus(req.body.status);

  if (deliveryId) {
    db.prepare(
      `UPDATE messages
       SET status = ?
       WHERE provider_ref = ?
         AND channel = 'sms'
         AND direction = 'outbound'`
    ).run(status, deliveryId);
  }

  res.type("text/plain").send("OK");
});

export default router;

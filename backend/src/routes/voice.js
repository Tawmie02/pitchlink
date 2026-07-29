// ============================================================
// AFRICA'S TALKING INTEGRATION POINT: Voice callback
// ============================================================
// >>> Register this endpoint's public URL in the AT Sandbox dashboard:
//       Sandbox app -> Voice -> your number -> "Callback URL"
//       e.g. https://unearth-juvenile-reason.ngrok-free.dev/api/voice/events
//
// When triggerVoiceAlert() in services/africastalking.js starts a call,
// AT's servers call THIS endpoint once the callee picks up, asking what
// to do next. Response must be Africa's Talking Voice XML.
// Docs: https://developers.africastalking.com/docs/voice/response
// ============================================================

import { Router } from "express";
import { db } from "../db/index.js";
import { normalizePhone } from "../lib/phone.js";

const router = Router();

router.post("/events", (req, res) => {
  const { sessionId, callerNumber, isActive } = req.body;
  res.set("Content-Type", "text/xml");

  // 1. Look up by exact AT provider_ref (sessionId)
  let messageRow = sessionId
    ? db.prepare("SELECT * FROM messages WHERE provider_ref = ? AND channel = 'voice'").get(sessionId)
    : null;

  // 2. Fallback: look up most recent outbound voice message for caller phone
  if (!messageRow && callerNumber) {
    const normPhone = normalizePhone(callerNumber);
    messageRow = db
      .prepare(
        `SELECT msg.*
         FROM messages msg
         JOIN participants p ON p.id = msg.participant_id
         WHERE msg.channel = 'voice' AND msg.direction = 'outbound' AND p.phone = ?
         ORDER BY msg.created_at DESC, msg.id DESC
         LIMIT 1`
      )
      .get(normPhone);
  }

  const speech = messageRow?.body ||
    "This is an automated alert from Pitch Link. Please check the app for match updates.";

  // Say the message once, then hang up.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman" playBeep="false">${escapeXml(speech)}</Say>
</Response>`;

  res.send(xml);
});

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  }[c]));
}

export default router;

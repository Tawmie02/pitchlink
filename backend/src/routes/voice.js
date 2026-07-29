// ============================================================
// AFRICA'S TALKING INTEGRATION POINT: Voice callback
// ============================================================
// >>> Register this endpoint's public URL in the AT Sandbox dashboard:
//       Sandbox app -> Voice -> your number -> "Callback URL"
//       e.g. https://<your-ngrok-subdomain>.ngrok-free.app/api/voice/events
//
// When triggerVoiceAlert() in services/africastalking.js starts a call,
// AT's servers call THIS endpoint once the callee picks up, asking what
// to do next. Response must be Africa's Talking Voice XML.
// Docs: https://developers.africastalking.com/docs/voice/response
// ============================================================

import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

router.post("/events", (req, res) => {
  const { sessionId, callerNumber, isActive } = req.body;
  res.set("Content-Type", "text/xml");

  // Look up the message row created when we placed this call to fetch
  // the exact TTS body we wanted to read out.
  const messageRow = db
    .prepare("SELECT * FROM messages WHERE provider_ref = ? AND channel = 'voice'")
    .get(sessionId);

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
